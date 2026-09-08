using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Requests.Queries.GetRequest;
using RequestHub.Domain.Entities;
using RequestHub.Domain.Enums;
using RequestHub.Infrastructure.Persistence;

namespace RequestHub.Tests;

public class GetRequestQueryHandlerTests
{
    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task Missing_request_returns_null()
    {
        using var db = NewDb();
        var result = await new GetRequestQueryHandler(db).Handle(new(Guid.NewGuid()), CancellationToken.None);
        result.Should().BeNull();
    }

    [Fact]
    public async Task Read_projects_the_registered_payload_without_tracking_entities()
    {
        using var db = NewDb();
        var now = DateTime.UtcNow;
        var request = new Request
        {
            Id = Guid.NewGuid(), Name = "Order", Type = "text.uppercase", Payload = "HELLO",
            Status = RequestStatus.Processed, CreatedAt = now.AddMinutes(-1), ReceivedAt = now
        };
        db.Requests.Add(request);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await new GetRequestQueryHandler(db).Handle(new(request.Id), CancellationToken.None);

        result.Should().Be(new RequestDetailDto(request.Id, "Order", "text.uppercase", "HELLO",
            RequestStatus.Processed, request.CreatedAt, now));
        db.ChangeTracker.Entries().Should().BeEmpty();
    }
}
