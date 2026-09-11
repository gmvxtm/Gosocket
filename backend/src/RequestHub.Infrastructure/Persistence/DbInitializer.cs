using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Common.Interfaces;
using RequestHub.Domain.Entities;
using RequestHub.Infrastructure.Security;

namespace RequestHub.Infrastructure.Persistence;

public static class DbInitializer
{
    /// <summary>
    /// Applies the migrations and leaves one account ready, so a fresh deployment can be used
    /// without a manual step. It only seeds when the table is empty: it never touches an
    /// existing password.
    /// </summary>
    public static async Task InitializeAsync(
        AppDbContext db,
        IPasswordHasher hasher,
        SeedOptions seed,
        CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        if (await db.Users.AnyAsync(cancellationToken))
            return;

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Username = seed.Username.Trim().ToLowerInvariant(),
            DisplayName = seed.DisplayName,
            PasswordHash = hasher.Hash(seed.Password)
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
