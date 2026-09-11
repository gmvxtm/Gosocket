using RequestHub.Domain.Entities;

namespace RequestHub.Application.Common.Interfaces;

/// <summary>
/// Hashing algorithm behind the stored password. The Application layer only needs to create and
/// verify hashes; which algorithm does it is an Infrastructure decision.
/// </summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string hash);
}

/// <summary>Issues the access token that the caller sends back on every request.</summary>
public interface ITokenService
{
    (string Token, DateTime ExpiresAt) Issue(User user);
}
