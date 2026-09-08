using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence.Configurations;

public class RequestConfiguration : IEntityTypeConfiguration<Request>
{
    public void Configure(EntityTypeBuilder<Request> builder)
    {
        builder.ToTable("Requests", "core", t =>
        {
            t.HasCheckConstraint("CK_Requests_Status", "\"Status\" IN ('Pending', 'Processed', 'Failed')");
            t.HasCheckConstraint("CK_Requests_RecordStatus", "\"RecordStatus\" IN ('A', 'I')");
        });

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.Name).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Type).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Payload).IsRequired();

        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.ConfigureAudit();

        builder.HasIndex(r => r.ReceivedAt);
        builder.HasIndex(r => r.Type);
    }
}
