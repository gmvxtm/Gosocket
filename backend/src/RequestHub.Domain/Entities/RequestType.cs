namespace RequestHub.Domain.Entities;

public class RequestType : AuditableEntity
{
    public Guid Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
