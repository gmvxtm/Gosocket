namespace RequestHub.Tests.Support;

/// <summary>A clock frozen at a known instant, so handlers produce deterministic timestamps.</summary>
internal sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}
