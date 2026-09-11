namespace RequestHub.Infrastructure.Security;

/// <summary>Account created on an empty database. Meant to be overridden per environment.</summary>
public class SeedOptions
{
    public const string SectionName = "Seed";

    public string Username { get; set; } = "admin";

    public string DisplayName { get; set; } = "Administrador";

    public string Password { get; set; } = "Admin.12345";
}
