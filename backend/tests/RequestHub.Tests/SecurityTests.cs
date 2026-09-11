using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.Extensions.Options;
using RequestHub.Domain.Entities;
using RequestHub.Infrastructure.Security;
using RequestHub.Tests.Support;

namespace RequestHub.Tests;

public class BCryptPasswordHasherTests
{
    private readonly BCryptPasswordHasher _hasher = new();

    [Fact]
    public void A_hash_verifies_its_own_password()
    {
        var hash = _hasher.Hash("Secreta.12345");

        _hasher.Verify("Secreta.12345", hash).Should().BeTrue();
        _hasher.Verify("secreta.12345", hash).Should().BeFalse();
    }

    [Fact]
    public void The_same_password_produces_different_hashes()
    {
        // Each hash carries its own salt, so two equal passwords are not equal in the database.
        _hasher.Hash("Secreta.12345").Should().NotBe(_hasher.Hash("Secreta.12345"));
    }

    [Fact]
    public void A_stored_value_that_is_not_a_hash_fails_verification_instead_of_throwing()
    {
        _hasher.Verify("Secreta.12345", "no-es-un-hash").Should().BeFalse();
    }
}

public class JwtTokenServiceTests
{
    private static readonly DateTime Now = new(2026, 9, 10, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void The_token_carries_the_user_and_expires_when_configured()
    {
        var options = new JwtOptions { ExpiresMinutes = 60 };
        var service = new JwtTokenService(Options.Create(options), new FixedTimeProvider(Now));
        var user = new User { Id = Guid.NewGuid(), Username = "gino", DisplayName = "Gino Maguina" };

        var (token, expiresAt) = service.Issue(user);

        expiresAt.Should().Be(Now.AddHours(1));

        var decoded = new JwtSecurityTokenHandler().ReadJwtToken(token);
        decoded.Issuer.Should().Be(options.Issuer);
        decoded.Audiences.Should().ContainSingle().Which.Should().Be(options.Audience);
        decoded.Subject.Should().Be(user.Id.ToString());
        decoded.Claims.Should().Contain(c => c.Type == "unique_name" && c.Value == "gino");
        decoded.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == "Gino Maguina");
    }

    [Fact]
    public void Two_tokens_for_the_same_user_are_distinguishable()
    {
        var service = new JwtTokenService(Options.Create(new JwtOptions()), new FixedTimeProvider(Now));
        var user = new User { Id = Guid.NewGuid(), Username = "gino" };

        var first = new JwtSecurityTokenHandler().ReadJwtToken(service.Issue(user).Token);
        var second = new JwtSecurityTokenHandler().ReadJwtToken(service.Issue(user).Token);

        first.Id.Should().NotBe(second.Id);
    }
}
