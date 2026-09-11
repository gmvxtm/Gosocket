import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RequestList } from '../components/RequestList';
import { RequestDetail } from '../components/RequestDetail';
import { useRequests } from '../hooks/useRequests';

/**
 * List and detail share a route: on a wide screen both fit side by side, and the address bar
 * still points at the selected request so a detail can be linked or reloaded.
 */
export function RequestsPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const requests = useRequests();
  const rows = requests.data ?? [];
  const selected = rows.find(request => request.id === id);

  return (
    <div className="split">
      <RequestList requests={rows} selectedId={selected?.id} loading={requests.isPending}
        onSelect={requestId => void navigate('/requests/' + requestId)} />

      <div>
        <RequestDetail request={selected} />
        {selected && (
          <button type="button" className="back" onClick={() => void navigate('/requests')}>
            {t('detail.back')}
          </button>
        )}
      </div>
    </div>
  );
}
