namespace RequestHub.Application.Common.Interfaces;

/// <summary>
/// Identifies who is calling, without leaking ASP.NET types into the Application layer.
/// Used to stamp the audit columns (RecordCreationUser, RecordEditUser).
/// The concrete implementation reads the request in the Presentation layer.
/// </summary>
public interface ICurrentUser
{
    string Username { get; }
}
