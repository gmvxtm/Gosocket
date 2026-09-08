using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence.Configurations;

internal static class AuditConfigurationExtensions
{
    public static void ConfigureAudit<T>(this EntityTypeBuilder<T> builder) where T : AuditableEntity
    {
        builder.Property(e => e.RecordCreationUser).HasMaxLength(80);
        builder.Property(e => e.RecordEditUser).HasMaxLength(80);
        builder.Property(e => e.RecordStatus).HasMaxLength(1).IsRequired().HasDefaultValue("A");
    }
}
