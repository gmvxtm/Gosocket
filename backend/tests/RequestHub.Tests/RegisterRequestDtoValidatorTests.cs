using FluentValidation.TestHelper;
using RequestHub.Application.Requests.Dtos;

namespace RequestHub.Tests;

public class RegisterRequestDtoValidatorTests
{
    private readonly RegisterRequestDtoValidator _validator = new();

    private static RegisterRequestDto ValidDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Order 1001",
        Type = "text.uppercase",
        Payload = "HELLO",
        CreatedAt = DateTime.UtcNow.AddMinutes(-1)
    };

    [Fact]
    public void Valid_request_passes()
    {
        var result = _validator.TestValidate(ValidDto());

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_id_is_rejected()
    {
        var dto = ValidDto();
        dto.Id = Guid.Empty;

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_name_is_rejected(string name)
    {
        var dto = ValidDto();
        dto.Name = name;

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Name_longer_than_the_column_is_rejected()
    {
        var dto = ValidDto();
        dto.Name = new string('x', RegisterRequestDtoValidator.NameMaxLength + 1);

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Empty_payload_is_allowed_but_null_is_not()
    {
        var dto = ValidDto();
        dto.Payload = string.Empty;
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.Payload);

        dto.Payload = null!;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.Payload);
    }

    [Fact]
    public void Created_at_in_the_future_is_rejected()
    {
        var dto = ValidDto();
        dto.CreatedAt = DateTime.UtcNow.AddHours(1);

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor(x => x.CreatedAt);
    }

    [Fact]
    public void Default_created_at_is_rejected()
    {
        var dto = ValidDto();
        dto.CreatedAt = default;

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor(x => x.CreatedAt);
    }
}
