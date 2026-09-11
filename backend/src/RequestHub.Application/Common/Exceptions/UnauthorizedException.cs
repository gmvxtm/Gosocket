namespace RequestHub.Application.Common.Exceptions;

/// <summary>Wrong credentials. Carries no detail about which part failed.</summary>
public class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
}
