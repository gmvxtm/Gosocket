using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace RequestHub.Api.Common;

public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Requests allowed per caller in a one minute window.</summary>
    public int PermitsPerMinute { get; set; } = 120;

    /// <summary>Callers waiting for a permit before the window resets.</summary>
    public int QueueLimit { get; set; } = 0;

    /// <summary>Synchronizations allowed to hit the database at the same time.</summary>
    public int MaxConcurrentSynchronizations { get; set; } = 4;

    /// <summary>Synchronizations parked until a slot frees up.</summary>
    public int SynchronizationQueueLimit { get; set; } = 8;
}

public static class RateLimitingSetup
{
    /// <summary>Name of the bulkhead applied to the synchronization endpoint.</summary>
    public const string SynchronizationPolicy = "synchronization";

    /// <summary>
    /// Two independent limits protect the API. The global window caps how often a single caller
    /// can hit it, and the bulkhead caps how many synchronizations run against the database at
    /// once, so a burst of large batches cannot starve the read endpoints or the health check.
    /// </summary>
    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>()
            ?? new RateLimitingOptions();

        services.AddRateLimiter(limiter =>
        {
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(CallerOf(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = options.PermitsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = options.QueueLimit,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                }));

            limiter.AddConcurrencyLimiter(SynchronizationPolicy, concurrency =>
            {
                concurrency.PermitLimit = options.MaxConcurrentSynchronizations;
                concurrency.QueueLimit = options.SynchronizationQueueLimit;
                concurrency.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            limiter.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Too many requests.",
                    Detail = "The caller exceeded the allowed rate or the synchronization queue is full.",
                    Type = "https://tools.ietf.org/html/rfc6585#section-4"
                };

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    var seconds = ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                    context.HttpContext.Response.Headers.RetryAfter = seconds;
                    problem.Extensions["retryAfterSeconds"] = seconds;
                }

                var service = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
                await service.TryWriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = problem
                });
            };
        });

        return services;
    }

    // Authenticated callers get their own window; anonymous ones fall back to the remote address.
    private static string CallerOf(HttpContext context)
        => context.User.Identity?.Name
           ?? context.Connection.RemoteIpAddress?.ToString()
           ?? "unknown";
}
