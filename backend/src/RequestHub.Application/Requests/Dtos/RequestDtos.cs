using RequestHub.Domain.Enums;

namespace RequestHub.Application.Requests.Dtos;

public class RegisterRequestDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public record RequestAckDto(Guid Id, RequestStatus Status, DateTime ReceivedAt, bool AlreadyRegistered);
