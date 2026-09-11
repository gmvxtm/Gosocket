using System.Reflection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace RequestHub.Api.Common;

public static class TelemetrySetup
{
    public const string ServiceName = "request-hub-api";

    /// <summary>Standard variable read by every OpenTelemetry SDK.</summary>
    public const string EndpointVariable = "OTEL_EXPORTER_OTLP_ENDPOINT";

    public static string? OtlpEndpoint(this IConfiguration configuration)
    {
        var endpoint = configuration[EndpointVariable];
        return string.IsNullOrWhiteSpace(endpoint) ? null : endpoint;
    }

    public static string ServiceVersion =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

    /// <summary>
    /// Exports traces and metrics through OTLP when a collector is configured. Without the
    /// variable the API runs with no exporter, so the tests and a plain `dotnet run` do not
    /// need a dashboard listening.
    /// </summary>
    public static IServiceCollection AddApiTelemetry(this IServiceCollection services, IConfiguration configuration)
    {
        if (configuration.OtlpEndpoint() is null)
            return services;

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(ServiceName, serviceVersion: ServiceVersion))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation(options =>
                {
                    options.RecordException = true;
                    // The container health check runs every few seconds and would bury the real traffic.
                    options.Filter = context => !context.Request.Path.StartsWithSegments("/health");
                })
                .AddHttpClientInstrumentation()
                // Npgsql publishes one activity per SQL command under this source name.
                .AddSource("Npgsql")
                .AddOtlpExporter())
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                // Publishes the leases the limiter grants, queues and rejects.
                .AddMeter("Microsoft.AspNetCore.RateLimiting")
                .AddOtlpExporter());

        return services;
    }
}
