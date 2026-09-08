using MediatR;
using Microsoft.EntityFrameworkCore;
using RequestHub.Application.Common.Interfaces;
using RequestHub.Domain.Enums;

namespace RequestHub.Application.Requests.Queries.GetRequest;

public record RequestDetailDto(Guid Id, string Name, string Type, string Payload,
    RequestStatus Status, DateTime CreatedAt, DateTime ReceivedAt);

public record GetRequestQuery(Guid Id) : IRequest<RequestDetailDto?>;

public class GetRequestQueryHandler(IAppDbContext db) : IRequestHandler<GetRequestQuery, RequestDetailDto?>
{
    public Task<RequestDetailDto?> Handle(GetRequestQuery request, CancellationToken cancellationToken)
        => db.Requests.AsNoTracking()
            .Where(item => item.Id == request.Id)
            .Select(item => new RequestDetailDto(item.Id, item.Name, item.Type, item.Payload,
                item.Status, item.CreatedAt, item.ReceivedAt))
            .SingleOrDefaultAsync(cancellationToken);
}
