using RequestHub.Application.Common.Interfaces;

namespace RequestHub.Api.Common;

/// <summary>
/// Reads the authenticated identity from the request. This is the implementation the Application
/// layer was already waiting for: with it the audit columns record who registered each row
/// instead of falling back to SYSTEM.
/// </summary>
public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    public string Username => _accessor.HttpContext?.User.Identity?.Name ?? "SYSTEM";
}
