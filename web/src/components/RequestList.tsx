import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalRequest, RequestStatus } from '../api';
import { StatusPill } from './StatusPill';

interface Props {
  requests: LocalRequest[];
  selectedId?: string;
  loading: boolean;
  onSelect: (id: string) => void;
}

const statuses: RequestStatus[] = ['Pending', 'Processed', 'Failed'];

export function RequestList({ requests, selectedId, loading, onSelect }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RequestStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  // Filtering is ephemeral UI state: it does not belong to the cache or to the store.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter(request =>
      (status === 'all' || request.status === status) &&
      (term === '' || request.name.toLowerCase().includes(term)));
  }, [requests, status, search]);

  return (
    <section className="panel list-panel">
      <div className="panel-head">
        <h2>{t('list.title')}</h2>
        <span className="counter">{visible.length}/{requests.length}</span>
      </div>

      <div className="filters">
        <label className="inline-field">
          <span className="sr-only">{t('list.search')}</span>
          <input type="search" placeholder={t('list.search')} aria-label={t('list.search')}
            value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="inline-field">
          <span className="sr-only">{t('list.filter')}</span>
          <select aria-label={t('list.filter')} value={status}
            onChange={event => setStatus(event.target.value as RequestStatus | 'all')}>
            <option value="all">{t('list.all')}</option>
            {statuses.map(value => (
              <option key={value} value={value}>{t('status.' + value.toLowerCase())}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="request-list" aria-busy={loading}>
        {visible.map(request => (
          <button key={request.id} className={selectedId === request.id ? 'row selected' : 'row'} type="button"
            aria-pressed={selectedId === request.id} onClick={() => onSelect(request.id)}>
            <span><strong>{request.name}</strong><small>{request.type}</small></span>
            <StatusPill status={request.status} />
          </button>
        ))}
        {visible.length === 0 && <p className="empty">{loading ? t('list.loading') : t('list.empty')}</p>}
      </div>
    </section>
  );
}
