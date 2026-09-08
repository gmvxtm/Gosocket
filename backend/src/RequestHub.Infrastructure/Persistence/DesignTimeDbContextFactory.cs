using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RequestHub.Infrastructure.Persistence;

/// <summary>Lets `dotnet ef migrations` build the context at design time without the API host.</summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Design-time only. Matches the "central" database from docker-compose; it doesn't affect
        // the running app's connection string.
        var connectionString = "Host=localhost;Port=5433;Database=requests_central;Username=app;Password=app";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
