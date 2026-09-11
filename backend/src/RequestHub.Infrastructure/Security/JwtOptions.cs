namespace RequestHub.Infrastructure.Security;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "request-hub";

    public string Audience { get; set; } = "offline-requests";

    /// <summary>Signing key. It comes from the environment; the default only serves local runs.</summary>
    public string Key { get; set; } = "development-only-signing-key-change-me-please";

    public int ExpiresMinutes { get; set; } = 480;
}
