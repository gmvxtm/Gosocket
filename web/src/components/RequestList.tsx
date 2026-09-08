import type { LocalRequest } from '../api';

interface Props {
  requests: LocalRequest[];
  selectedId?: string;
  loading: boolean;
  onSelect: (id: string) => void;
}

export function RequestList({ requests, selectedId, loading, onSelect }: Props) {
  return (
    <section className="panel list-panel">
      <h2>Requests</h2>
      <div className="request-list" aria-busy={loading}>
        {requests.map(request => (
          <button key={request.id} className={selectedId === request.id ? 'row selected' : 'row'} type="button"
            aria-pressed={selectedId === request.id} onClick={() => onSelect(request.id)}>
            <span><strong>{request.name}</strong><small>{request.type}</small></span>
            <span className={'pill ' + request.status.toLowerCase()}>{request.status}</span>
          </button>
        ))}
        {requests.length === 0 && <p className="empty">{loading ? 'Loading requests...' : 'No requests yet.'}</p>}
      </div>
    </section>
  );
}
