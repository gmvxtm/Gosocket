using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Common.Interfaces;
using RequestHub.Application.Requests.Dtos;
using RequestHub.Domain.Entities;
using RequestHub.Domain.Enums;

namespace RequestHub.Application.Requests.Commands.RegisterRequests;

public record RegisterRequestsCommand(IReadOnlyList<RegisterRequestDto> Requests) : IRequest<IReadOnlyList<RequestAckDto>>;

public class RegisterRequestsCommandValidator : AbstractValidator<RegisterRequestsCommand>
{
    public const int MaxBatchSize = 500;

    public RegisterRequestsCommandValidator()
    {
        RuleFor(x => x.Requests)
            .NotEmpty().WithMessage("At least one request is required.")
            .Must(r => r.Count <= MaxBatchSize).WithMessage($"A batch can contain at most {MaxBatchSize} requests.");

        RuleForEach(x => x.Requests).SetValidator(new RegisterRequestDtoValidator());
    }
}

public class RegisterRequestsCommandHandler : IRequestHandler<RegisterRequestsCommand, IReadOnlyList<RequestAckDto>>
{
    private readonly IAppDbContext _db;
    private readonly TimeProvider _clock;

    public RegisterRequestsCommandHandler(IAppDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<IReadOnlyList<RequestAckDto>> Handle(RegisterRequestsCommand request, CancellationToken cancellationToken)
    {
        var receivedAt = _clock.GetUtcNow().UtcDateTime;

        var incoming = request.Requests
            .GroupBy(r => r.Id)
            .Select(g => g.First())
            .ToList();
        var duplicateIds = request.Requests
            .GroupBy(r => r.Id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        var ids = incoming.Select(r => r.Id).ToList();
        var existing = await _db.Requests
            .AsNoTracking()
            .Where(r => ids.Contains(r.Id))
            .Select(r => new { r.Id, r.Status, r.ReceivedAt })
            .ToDictionaryAsync(r => r.Id, cancellationToken);
        var newItems = incoming
            .Where(dto => !existing.ContainsKey(dto.Id))
            .ToList();

        await EnsureRequestTypesAsync(newItems, cancellationToken);

        foreach (var id in duplicateIds)
        {
            _db.SyncIssues.Add(new SyncIssue
            {
                Id = Guid.NewGuid(),
                RequestId = id,
                IssueType = "DuplicateInBatch",
                Message = "Repeated request Id collapsed inside the synchronization batch.",
                CreatedAt = receivedAt
            });
        }

        var acks = new List<RequestAckDto>(incoming.Count);
        foreach (var dto in incoming)
        {
            if (existing.TryGetValue(dto.Id, out var stored))
            {
                _db.SyncIssues.Add(new SyncIssue
                {
                    Id = Guid.NewGuid(),
                    RequestId = dto.Id,
                    IssueType = "AlreadyRegistered",
                    Message = "Request Id was already present in the central registry.",
                    CreatedAt = receivedAt
                });
                acks.Add(new RequestAckDto(dto.Id, stored.Status, stored.ReceivedAt, AlreadyRegistered: true));
                continue;
            }

            _db.Requests.Add(new Request
            {
                Id = dto.Id,
                Name = dto.Name.Trim(),
                Type = dto.Type.Trim(),
                Payload = dto.Payload,
                Status = RequestStatus.Processed,
                CreatedAt = ToUtc(dto.CreatedAt),
                ReceivedAt = receivedAt
            });

            acks.Add(new RequestAckDto(dto.Id, RequestStatus.Processed, receivedAt, AlreadyRegistered: false));
        }

        await _db.SaveChangesAsync(cancellationToken);
        return acks;
    }

    private async Task EnsureRequestTypesAsync(IReadOnlyCollection<RegisterRequestDto> requests, CancellationToken cancellationToken)
    {
        var types = requests
            .Select(r => r.Type.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (types.Count == 0) return;

        var known = await _db.RequestTypes
            .Where(t => types.Contains(t.Code))
            .Select(t => t.Code)
            .ToListAsync(cancellationToken);
        var knownSet = known.ToHashSet(StringComparer.Ordinal);

        foreach (var type in types.Where(t => !knownSet.Contains(t)))
        {
            _db.RequestTypes.Add(new RequestType
            {
                Id = Guid.NewGuid(),
                Code = type,
                Name = type
            });
        }
    }

    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
