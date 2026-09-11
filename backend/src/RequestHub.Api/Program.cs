using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using MediatR;
using RequestHub.Api.Common;
using RequestHub.Application;
using RequestHub.Application.Requests.Commands.RegisterRequests;
using RequestHub.Application.Requests.Dtos;
using RequestHub.Application.Requests.Queries.GetRequest;
using RequestHub.Infrastructure;
using RequestHub.Infrastructure.Persistence;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration)
          .WriteTo.Console());

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.Configure<JsonOptions>(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database");

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbInitializer.InitializeAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();

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
.WithSummary("Registers processed requests coming from the offline sync service.");

app.MapGet("/requests/{id:guid}", async (Guid id, ISender sender, CancellationToken cancellationToken) =>
{
    var request = await sender.Send(new GetRequestQuery(id), cancellationToken);
    return request is null ? Results.NotFound() : Results.Ok(request);
})
.WithName("GetRegisteredRequest")
.WithSummary("Returns a centrally registered request for synchronization verification.");

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
});

await app.RunAsync();
