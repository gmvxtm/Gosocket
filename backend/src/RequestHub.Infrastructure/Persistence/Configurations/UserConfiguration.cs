using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users", "sgr", t =>
            t.HasCheckConstraint("CK_Users_RecordStatus", "\"RecordStatus\" IN ('A', 'I')"));

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id).ValueGeneratedNever();

        builder.Property(u => u.Username).HasMaxLength(80).IsRequired();
        builder.Property(u => u.DisplayName).HasMaxLength(120).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(200).IsRequired();

        // Usernames are stored lowercase, so a unique index is enough to keep them unambiguous.
        builder.HasIndex(u => u.Username).IsUnique();

        builder.ConfigureAudit();

        builder.Property<uint>("Version")
            .IsRowVersion();
    }
}
