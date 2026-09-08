namespace RequestHub.Domain.Entities;

public abstract class AuditableEntity
{
    public string? RecordCreationUser { get; set; }
    public DateTimeOffset? RecordCreationDate { get; set; }
    public string? RecordEditUser { get; set; }
    public DateTimeOffset? RecordEditDate { get; set; }
    public string RecordStatus { get; set; } = "A";
}
