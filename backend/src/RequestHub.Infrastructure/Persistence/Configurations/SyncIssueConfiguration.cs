using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence.Configurations;

public class SyncIssueConfiguration : IEntityTypeConfiguration<SyncIssue>
{
    public void Configure(EntityTypeBuilder<SyncIssue> builder)
    {
        builder.ToTable("SyncIssues", "log");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.IssueType).HasMaxLength(80).IsRequired();
        builder.Property(i => i.Message).HasMaxLength(500).IsRequired();

        builder.HasIndex(i => i.CreatedAt);
        builder.HasIndex(i => i.RequestId);
        builder.HasIndex(i => i.IssueType);
    }
}
