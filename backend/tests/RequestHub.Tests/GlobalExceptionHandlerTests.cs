using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RequestHub.Api.Common;
using RequestHub.Application.Common.Exceptions;

namespace RequestHub.Tests;

public class GlobalExceptionHandlerTests
{
    private readonly Mock<IProblemDetailsService> _problemDetails = new();
    private ProblemDetailsContext? _written;

    public GlobalExceptionHandlerTests()
    {
        _problemDetails
            .Setup(service => service.TryWriteAsync(It.IsAny<ProblemDetailsContext>()))
            .Callback<ProblemDetailsContext>(context => _written = context)
            .ReturnsAsync(true);
    }

    private async Task<HttpContext> Handle(Exception exception)
    {
        var handler = new GlobalExceptionHandler(_problemDetails.Object, NullLogger<GlobalExceptionHandler>.Instance);
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/requests/sync";

        var handled = await handler.TryHandleAsync(context, exception, CancellationToken.None);

        handled.Should().BeTrue();
        return context;
    }

    [Fact]
    public async Task Validation_failures_become_a_400_with_the_field_errors()
    {
        var exception = new ValidationException(new[]
        {
            new ValidationFailure("Name", "Name is required."),
            new ValidationFailure("Payload", "Payload is required (it can be empty, not null).")
        });

        var context = await Handle(exception);

        context.Response.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        _written!.ProblemDetails.Should().BeOfType<ValidationProblemDetails>()
            .Which.Errors.Should().ContainKeys("Name", "Payload");
    }

    [Fact]
    public async Task Missing_resources_become_a_404()
    {
        var context = await Handle(new NotFoundException("Request", Guid.NewGuid()));

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        _written!.ProblemDetails.Detail.Should().Contain("was not found");
    }

    [Fact]
    public async Task Unexpected_failures_become_a_500_without_leaking_the_message()
    {
        var context = await Handle(new InvalidOperationException("connection string user=app password=app"));

        context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        _written!.ProblemDetails.Detail.Should().BeNull();
        _written.ProblemDetails.Title.Should().Be("An unexpected error occurred.");
    }

    [Fact]
    public async Task Every_response_carries_a_trace_id()
    {
        await Handle(new NotFoundException("Request", Guid.NewGuid()));

        _written!.ProblemDetails.Extensions.Should().ContainKey("traceId");
    }
}
