using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RequestHub.Application.Auth.Commands.Login;
using RequestHub.Application.Common.Exceptions;
using RequestHub.Domain.Entities;
using RequestHub.Infrastructure.Persistence;
using RequestHub.Infrastructure.Security;
using RequestHub.Tests.Support;

namespace RequestHub.Tests;

/// <summary>
/// Login against EF Core InMemory, with the real hasher and the real token service: the point of
/// these tests is the credential check, so faking them would test nothing.
/// </summary>
public class LoginCommandHandlerTests
{
    private static readonly DateTime Now = new(2026, 9, 10, 12, 0, 0, DateTimeKind.Utc);
    private const string Password = "Secreta.12345";

    private readonly BCryptPasswordHasher _hasher = new();

    private AppDbContext NewDbWith(User user)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        db.Users.Add(user);
        db.SaveChanges();
        return db;
    }

    private User NewUser(string username = "gino", string recordStatus = "A") => new()
    {
        Id = Guid.NewGuid(),
        Username = username,
        DisplayName = "Gino Maguina",
        PasswordHash = _hasher.Hash(Password),
        RecordStatus = recordStatus
    };

    private LoginCommandHandler NewHandler(AppDbContext db)
    {
        var clock = new FixedTimeProvider(Now);
        var tokens = new JwtTokenService(Options.Create(new JwtOptions()), clock);
        return new LoginCommandHandler(db, _hasher, tokens, clock);
    }

    [Fact]
    public async Task Valid_credentials_return_a_token_and_stamp_the_login()
    {
        using var db = NewDbWith(NewUser());

        var result = await NewHandler(db).Handle(new LoginCommand("gino", Password), CancellationToken.None);

        result.Token.Should().NotBeNullOrWhiteSpace();
        result.Username.Should().Be("gino");
        result.DisplayName.Should().Be("Gino Maguina");
        result.ExpiresAt.Should().Be(Now.AddMinutes(new JwtOptions().ExpiresMinutes));
        db.Users.Single().LastLoginAt.Should().Be(Now);
    }

    [Fact]
    public async Task The_username_is_matched_without_case_or_padding()
    {
        using var db = NewDbWith(NewUser());

        var result = await NewHandler(db).Handle(new LoginCommand("  GINO  ", Password), CancellationToken.None);

        result.Username.Should().Be("gino");
    }

    [Fact]
    public async Task A_wrong_password_is_rejected()
    {
        using var db = NewDbWith(NewUser());

        var login = () => NewHandler(db).Handle(new LoginCommand("gino", "otra clave"), CancellationToken.None);

        await login.Should().ThrowAsync<UnauthorizedException>();
        db.Users.Single().LastLoginAt.Should().BeNull();
    }

    [Fact]
    public async Task An_unknown_user_fails_the_same_way_as_a_wrong_password()
    {
        using var db = NewDbWith(NewUser());

        var login = () => NewHandler(db).Handle(new LoginCommand("nadie", Password), CancellationToken.None);

        // Same exception and same message: the caller cannot tell which accounts exist.
        (await login.Should().ThrowAsync<UnauthorizedException>())
            .WithMessage("Invalid username or password.");
    }

    [Fact]
    public async Task A_deactivated_account_cannot_log_in()
    {
        using var db = NewDbWith(NewUser(recordStatus: "I"));

        var login = () => NewHandler(db).Handle(new LoginCommand("gino", Password), CancellationToken.None);

        await login.Should().ThrowAsync<UnauthorizedException>();
    }
}
