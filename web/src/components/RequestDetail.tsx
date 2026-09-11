import { useTranslation } from 'react-i18next';
import type { LocalRequest } from '../api';
import { StatusPill } from './StatusPill';

export function RequestDetail({ request }: { request?: LocalRequest }) {
  const { t } = useTranslation();

  if (!request) return <section className="panel detail-panel"><p className="empty">{t('detail.empty')}</p></section>;

  return (
    <section className="panel detail-panel">
      <div className="panel-head">
        <h2>{t('detail.title')}</h2>
        <StatusPill status={request.status} />
      </div>
      <dl>
        <dt>{t('detail.id')}</dt><dd>{request.id}</dd>
        <dt>{t('detail.name')}</dt><dd>{request.name}</dd>
        <dt>{t('detail.type')}</dt><dd>{request.type}</dd>
        <dt>{t('detail.created')}</dt><dd>{new Date(request.createdAt).toLocaleString()}</dd>
        <dt>{t('detail.updated')}</dt><dd>{new Date(request.updatedAt).toLocaleString()}</dd>
        <dt>{t('detail.payload')}</dt><dd><pre>{request.payload}</pre></dd>
        {request.lastError && <><dt>{t('detail.error')}</dt><dd className="error-message">{request.lastError}</dd></>}
      </dl>
    </section>
  );
}
