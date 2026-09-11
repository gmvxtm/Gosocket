using Microsoft.EntityFrameworkCore;
using RequestHub.Domain.Entities;

namespace RequestHub.Application.Common.Interfaces;

/// <summary>
/// The Application layer depends on this abstraction, not on the concrete EF Core AppDbContext
/// (which lives in Infrastructure). Exposes only the sets and the SaveChanges the handlers need.
/// The DbContext is the unit of work: everything a handler changes is committed together.
/// </summary>
public interface IAppDbContext
{
    DbSet<Request> Requests { get; }

    DbSet<User> Users { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
