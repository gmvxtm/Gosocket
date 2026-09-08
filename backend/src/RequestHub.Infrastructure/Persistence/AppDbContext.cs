using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Common.Interfaces;
using RequestHub.Domain.Entities;

namespace RequestHub.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ICurrentUser? _currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser? currentUser = null) : base(options)
        => _currentUser = currentUser;

    public DbSet<Request> Requests => Set<Request>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var user = _currentUser?.Username ?? "SYSTEM";

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.RecordCreationDate ??= now;
                entry.Entity.RecordCreationUser ??= user;
                if (string.IsNullOrWhiteSpace(entry.Entity.RecordStatus))
                    entry.Entity.RecordStatus = "A";
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.RecordEditDate = now;
                entry.Entity.RecordEditUser = user;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
