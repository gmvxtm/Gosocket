import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock, Send, Sigma } from 'lucide-react';
import { useRequests, useSynchronize } from '../hooks/useRequests';
import { StatusPill } from '../components/StatusPill';

/**
 * Answers the question the statement asks the loudest: what is pending and what already reached
 * the central registry. The counters come from the same cache the list uses, so they cannot
 * disagree with it.
 */
export function StatusPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requests = useRequests();
  const synchronize = useSynchronize();

  const rows = requests.data ?? [];
  const counters = [
    { key: 'pending', value: rows.filter(r => r.status === 'Pending').length, Icon: Clock, tone: 'pending' },
    { key: 'processed', value: rows.filter(r => r.status === 'Processed').length, Icon: CheckCircle2, tone: 'processed' },
    { key: 'failed', value: rows.filter(r => r.status === 'Failed').length, Icon: AlertTriangle, tone: 'failed' },
    { key: 'total', value: rows.length, Icon: Sigma, tone: 'total' }
  ];
  const pending = counters[0].value;
  const failed = rows.filter(request => request.status === 'Failed');

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('status.title')}</h2>
        <button type="button" className="primary" disabled={synchronize.isPending || pending === 0}
          onClick={() => synchronize.mutate()}>
          <Send size={18} />{synchronize.isPending ? t('actions.syncing') : t('actions.sync')}
        </button>
      </div>

      <p className="muted">{t('status.explanation')}</p>

      <div className="counters">
        {counters.map(({ key, value, Icon, tone }) => (
          <article key={key} className={'counter-card ' + tone}>
            <Icon size={20} aria-hidden="true" />
            <strong>{value}</strong>
            <span>{t('status.' + key + 'Count')}</span>
          </article>
        ))}
      </div>

      {synchronize.isError && <p role="alert" className="error-message">{synchronize.error.message}</p>}

      {synchronize.isSuccess && (
        <p role="status" className="feedback">
          {t('status.lastResult', { sent: synchronize.data.sent, failed: synchronize.data.failed.length })}
        </p>
      )}

      {rows.length === 0 && <p className="empty">{t('status.empty')}</p>}
      {rows.length > 0 && pending === 0 && <p className="empty">{t('status.allSynced')}</p>}

      {failed.length > 0 && (
        <div className="request-list">
          {failed.map(request => (
            <button key={request.id} type="button" className="row" onClick={() => void navigate('/requests/' + request.id)}>
              <span><strong>{request.name}</strong><small>{request.lastError}</small></span>
              <StatusPill status={request.status} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
