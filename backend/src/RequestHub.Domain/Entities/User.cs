namespace RequestHub.Domain.Entities;

public class User : AuditableEntity
{
    public Guid Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    /// <summary>BCrypt hash. The plain password never reaches the database or the logs.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    public DateTime? LastLoginAt { get; set; }
}
