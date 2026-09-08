using FluentValidation;

namespace RequestHub.Application.Requests.Dtos;

/// <summary>
/// Field rules for an incoming request. The length caps match the column sizes, so an oversized
/// value fails as a clean 400 instead of a database error.
/// </summary>
public class RegisterRequestDtoValidator : AbstractValidator<RegisterRequestDto>
{
    public const int NameMaxLength = 200;
    public const int TypeMaxLength = 100;
    public const int PayloadMaxLength = 64 * 1024;

    // Tolerates small clock differences between the client and this server.
    private static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(5);

    public RegisterRequestDtoValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id is required (client-generated Guid).");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(NameMaxLength).WithMessage($"Name can't exceed {NameMaxLength} characters.");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Type is required.")
            .MaximumLength(TypeMaxLength).WithMessage($"Type can't exceed {TypeMaxLength} characters.");

        RuleFor(x => x.Payload)
            .NotNull().WithMessage("Payload is required (it can be empty, not null).")
            .MaximumLength(PayloadMaxLength).WithMessage($"Payload can't exceed {PayloadMaxLength} characters.");

        RuleFor(x => x.CreatedAt)
            .NotEqual(default(DateTime)).WithMessage("CreatedAt is required.")
            .Must(NotInTheFuture).WithMessage("CreatedAt can't be in the future.");
    }

    private static bool NotInTheFuture(DateTime createdAt) =>
        createdAt.ToUniversalTime() <= DateTime.UtcNow.Add(ClockSkew);
}
