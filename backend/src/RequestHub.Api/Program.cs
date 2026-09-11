using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using MediatR;
using RequestHub.Api.Common;
using RequestHub.Application;
using RequestHub.Application.Auth.Commands.Login;
using RequestHub.Application.Auth.Dtos;
using RequestHub.Application.Requests.Commands.RegisterRequests;
using RequestHub.Application.Requests.Dtos;
using RequestHub.Application.Requests.Queries.GetRequest;
using Microsoft.Extensions.Options;
using RequestHub.Application.Common.Interfaces;
using RequestHub.Infrastructure;
using RequestHub.Infrastructure.Persistence;
using RequestHub.Infrastructure.Security;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.OpenTelemetry;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
{
    config.ReadFrom.Configuration(context.Configuration).WriteTo.Console();

    // The same logs reach the dashboard, correlated with the trace that produced them.
    if (context.Configuration.OtlpEndpoint() is { } endpoint)
    {
        config.WriteTo.OpenTelemetry(options =>
        {
            options.Endpoint = endpoint;
            options.Protocol = OtlpProtocol.Grpc;
            options.ResourceAttributes = new Dictionary<string, object>
            {
                ["service.name"] = TelemetrySetup.ServiceName,
                ["service.version"] = TelemetrySetup.ServiceVersion
            };
        });
    }
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.Configure<JsonOptions>(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddApiAuthentication(builder.Configuration);
builder.Services.AddApiRateLimiting(builder.Configuration);
builder.Services.AddApiTelemetry(builder.Configuration);

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database");

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

// After authentication: an identified caller gets its own window instead of sharing the one for its IP.
app.UseRateLimiter();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    var seed = scope.ServiceProvider.GetRequiredService<IOptions<SeedOptions>>().Value;
    await DbInitializer.InitializeAsync(db, hasher, seed);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging(options =>
{
    // The container probes /health every few seconds; at Verbose it stays below the minimum level.
    options.GetLevel = (context, _, exception) => exception is not null
        ? LogEventLevel.Error
        : context.Request.Path.StartsWithSegments("/health")
            ? LogEventLevel.Verbose
            : LogEventLevel.Information;
});

app.MapPost("/auth/login", async (
    LoginDto credentials,
    ISender sender,
    CancellationToken cancellationToken) =>
{
    var result = await sender.Send(new LoginCommand(credentials.Username, credentials.Password), cancellationToken);
    return Results.Ok(result);
})
.WithName("Login")
.WithSummary("Exchanges a username and password for an access token.")
.AllowAnonymous();

app.MapPost("/requests/sync", async (
    IReadOnlyList<RegisterRequestDto> requests,
    ISender sender,
    CancellationToken cancellationToken) =>
{
    // FluentValidation failures travel as exceptions up to GlobalExceptionHandler.
    var result = await sender.Send(new RegisterRequestsCommand(requests), cancellationToken);
    return Results.Ok(result);
})
.WithName("SyncRequests")
.WithSummary("Registers processed requests coming from the offline sync service.")
.RequireRateLimiting(RateLimitingSetup.SynchronizationPolicy)
.RequireAuthorization();

app.MapGet("/requests/{id:guid}", async (Guid id, ISender sender, CancellationToken cancellationToken) =>
{
    var request = await sender.Send(new GetRequestQuery(id), cancellationToken);
    return request is null ? Results.NotFound() : Results.Ok(request);
})
.WithName("GetRegisteredRequest")
.WithSummary("Returns a centrally registered request for synchronization verification.")
.RequireAuthorization();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var payload = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                durationMs = Math.Round(e.Value.Duration.TotalMilliseconds, 1)
            })
        });
        await context.Response.WriteAsync(payload);
    }
}).DisableRateLimiting();

await app.RunAsync();
