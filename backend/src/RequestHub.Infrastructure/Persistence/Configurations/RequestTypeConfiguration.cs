using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence.Configurations;

public class RequestTypeConfiguration : IEntityTypeConfiguration<RequestType>
{
    public void Configure(EntityTypeBuilder<RequestType> builder)
    {
        builder.ToTable("RequestTypes", "cnfg", t =>
            t.HasCheckConstraint("CK_RequestTypes_RecordStatus", "\"RecordStatus\" IN ('A', 'I')"));

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Code).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(120).IsRequired();

        builder.HasIndex(t => t.Code).IsUnique();

        builder.ConfigureAudit();

        builder.Property<uint>("Version")
            .IsRowVersion();
    }
}
