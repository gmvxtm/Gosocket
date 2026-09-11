using RequestHub.Application.Common.Interfaces;

namespace RequestHub.Infrastructure.Security;

/// <summary>
/// BCrypt with a work factor of 12. The cost is deliberate: a login takes a few hundred
/// milliseconds, which is irrelevant for a person and expensive for a brute force attempt.
/// </summary>
public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // A stored value that is not a BCrypt hash is a failed verification, not a crash.
            return false;
        }
    }
}
