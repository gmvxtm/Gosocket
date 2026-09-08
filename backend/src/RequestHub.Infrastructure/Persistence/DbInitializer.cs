using Microsoft.EntityFrameworkCore;

namespace RequestHub.Infrastructure.Persistence;

public static class DbInitializer
{
    public static Task InitializeAsync(AppDbContext db, CancellationToken cancellationToken = default)
        => db.Database.MigrateAsync(cancellationToken);
}
