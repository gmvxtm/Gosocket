using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Auth.Dtos;
using RequestHub.Application.Common.Exceptions;
using RequestHub.Application.Common.Interfaces;

namespace RequestHub.Application.Auth.Commands.Login;

public record LoginCommand(string Username, string Password) : IRequest<AuthResultDto>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required.")
            .MaximumLength(80).WithMessage("Username can't exceed 80 characters.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MaximumLength(128).WithMessage("Password can't exceed 128 characters.");
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResultDto>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITokenService _tokens;
    private readonly TimeProvider _clock;

    public LoginCommandHandler(IAppDbContext db, IPasswordHasher hasher, ITokenService tokens, TimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _clock = clock;
    }

    public async Task<AuthResultDto> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username, cancellationToken);

        // The same answer for an unknown user and for a wrong password: the caller learns nothing
        // about which accounts exist.
        if (user is null || user.RecordStatus != "A" || !_hasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedException("Invalid username or password.");

        var (token, expiresAt) = _tokens.Issue(user);

        user.LastLoginAt = _clock.GetUtcNow().UtcDateTime;
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The login stamp is audit data; concurrent valid logins must not reject the session.
        }

        return new AuthResultDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            Username = user.Username,
            DisplayName = user.DisplayName
        };
    }
}
