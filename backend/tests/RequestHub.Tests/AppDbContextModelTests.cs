using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using RequestHub.Infrastructure.Persistence;

namespace RequestHub.Tests;

public class AppDbContextModelTests
{
    [Fact]
    public void Model_has_no_changes_pending_a_migration()
    {
        // Guards against editing an entity configuration and forgetting `dotnet ef migrations add`.
        // Since EF 9, MigrateAsync refuses to run on a model with pending changes, which would break
        // the API on startup. No connection is opened: the check compares the model with the snapshot.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model-check")
            .Options;
        using var db = new AppDbContext(options);

        db.Database.HasPendingModelChanges().Should().BeFalse();
    }
}
