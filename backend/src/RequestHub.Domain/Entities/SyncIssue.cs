namespace RequestHub.Domain.Entities;

public class SyncIssue
{
    public Guid Id { get; set; }

    public Guid? RequestId { get; set; }

    public string IssueType { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
