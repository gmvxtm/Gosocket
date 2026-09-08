using RequestHub.Domain.Enums;

namespace RequestHub.Domain.Entities;

public class Request : AuditableEntity
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string Payload { get; set; } = string.Empty;

    public RequestStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime ReceivedAt { get; set; }
}
