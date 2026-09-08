using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Requests.Commands.RegisterRequests;
using RequestHub.Application.Requests.Dtos;
using RequestHub.Domain.Entities;
using RequestHub.Domain.Enums;
using RequestHub.Infrastructure.Persistence;
using RequestHub.Tests.Support;

namespace RequestHub.Tests;

/// <summary>
/// Handler-level tests for RegisterRequestsCommand using EF Core InMemory and a frozen clock.
/// </summary>
public class RegisterRequestsCommandHandlerTests
{
    private static readonly DateTime Now = new(2026, 9, 8, 15, 0, 0, DateTimeKind.Utc);

    private static AppDbContext NewInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static RegisterRequestsCommandHandler NewHandler(AppDbContext db)
        => new(db, new FixedTimeProvider(Now));

    private static RegisterRequestDto NewDto(Guid? id = null, string name = "Order 1001") => new()
    {
        Id = id ?? Guid.NewGuid(),
        Name = name,
        Type = "text.uppercase",
        Payload = "HELLO",
        CreatedAt = Now.AddMinutes(-10)
    };

    [Fact]
    public async Task Register_persists_new_requests_as_processed_with_the_server_received_time()
    {
        // Arrange
        using var db = NewInMemoryDb();
        var handler = NewHandler(db);
        var first = NewDto(name: "Order 1001");
        var second = NewDto(name: "Order 1002");

        // Act
        var acks = await handler.Handle(new RegisterRequestsCommand([first, second]), CancellationToken.None);

        // Assert
        acks.Should().HaveCount(2);
        acks.Should().OnlyContain(a => a.Status == RequestStatus.Processed && !a.AlreadyRegistered && a.ReceivedAt == Now);
        acks.Select(a => a.Id).Should().ContainInOrder(first.Id, second.Id);

        var stored = await db.Requests.OrderBy(r => r.Name).ToListAsync();
        stored.Should().HaveCount(2);
        stored[0].Should().BeEquivalentTo(new
        {
            first.Id,
            Name = "Order 1001",
            Type = "text.uppercase",
            Payload = "HELLO",
            Status = RequestStatus.Processed,
            ReceivedAt = Now
        });
        stored[0].RecordCreationUser.Should().Be("SYSTEM");
        stored[0].RecordCreationDate.Should().NotBeNull();
        stored[0].RecordStatus.Should().Be("A");
    }

    [Fact]
    public async Task Register_acknowledges_already_registered_ids_without_creating_duplicates()
    {
        // Arrange
        using var db = NewInMemoryDb();
        var earlier = Now.AddHours(-1);
        var existing = new Request
        {
            Id = Guid.NewGuid(),
            Name = "Order 1001",
            Type = "text.uppercase",
            Payload = "HELLO",
            Status = RequestStatus.Processed,
            CreatedAt = earlier.AddMinutes(-5),
            ReceivedAt = earlier
        };
        db.Requests.Add(existing);
        await db.SaveChangesAsync();

        var handler = NewHandler(db);
        var retry = NewDto(existing.Id);
        var fresh = NewDto(name: "Order 1002");

        // Act
        var acks = await handler.Handle(new RegisterRequestsCommand([retry, fresh]), CancellationToken.None);

        // Assert
        acks.Should().HaveCount(2);
        acks[0].Should().Be(new RequestAckDto(existing.Id, RequestStatus.Processed, earlier, AlreadyRegistered: true));
        acks[1].AlreadyRegistered.Should().BeFalse();
        acks[1].ReceivedAt.Should().Be(Now);

        db.Requests.Should().HaveCount(2, "the retried Id must not be stored twice");
        (await db.Requests.SingleAsync(r => r.Id == existing.Id)).ReceivedAt.Should().Be(earlier, "an existing row is never overwritten");
    }

    [Fact]
    public async Task Register_collapses_repeated_ids_within_the_same_batch()
    {
        // Arrange
        using var db = NewInMemoryDb();
        var handler = NewHandler(db);
        var id = Guid.NewGuid();
        var original = NewDto(id, name: "Order 1001");
        var duplicate = NewDto(id, name: "Order 1001 (resent)");

        // Act
        var acks = await handler.Handle(new RegisterRequestsCommand([original, duplicate]), CancellationToken.None);

        // Assert
        acks.Should().ContainSingle().Which.Id.Should().Be(id);
        db.Requests.Should().ContainSingle().Which.Name.Should().Be("Order 1001", "the first occurrence wins");
    }

    [Fact]
    public async Task Register_stores_created_at_as_utc_and_trims_name_and_type()
    {
        // Arrange
        using var db = NewInMemoryDb();
        var handler = NewHandler(db);
        var dto = NewDto(name: "  Order 1001  ");
        dto.Type = " text.uppercase ";
        dto.CreatedAt = new DateTime(2026, 9, 8, 14, 30, 0, DateTimeKind.Unspecified);

        // Act
        await handler.Handle(new RegisterRequestsCommand([dto]), CancellationToken.None);

        // Assert
        var stored = db.Requests.Single();
        stored.Name.Should().Be("Order 1001");
        stored.Type.Should().Be("text.uppercase");
        stored.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
        stored.CreatedAt.Should().Be(new DateTime(2026, 9, 8, 14, 30, 0, DateTimeKind.Utc));
    }
}
