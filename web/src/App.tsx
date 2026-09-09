import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Send, Wifi, WifiOff } from 'lucide-react';
import { RequestForm } from './components/RequestForm';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';
import { GroupPanel } from './components/GroupPanel';
import {
  localKeys, useCreateGroup, useCreateRequest, useGroups, useGroupTotals,
  useProcessors, useRequests, useServiceHealth, useSynchronize, useSynchronizeGroup
} from './hooks/useRequests';

export function App() {
  const client = useQueryClient();
  const requestsQuery = useRequests();
  const processorsQuery = useProcessors();
  const groupsQuery = useGroups();
  const health = useServiceHealth();
  const create = useCreateRequest();
  const createGroup = useCreateGroup();
  const synchronize = useSynchronize();
  const synchronizeGroup = useSynchronizeGroup();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requests = requestsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const totals = useGroupTotals(groups.map(group => group.id));
  const selected = requests.find(request => request.id === selectedId) ?? requests[0];
  const serviceOnline = health.isSuccess && health.data.status === 'Healthy';
  const queryError = requestsQuery.error ?? processorsQuery.error ?? groupsQuery.error ?? health.error;
  const lastSync = synchronize.isSuccess ? synchronize.data : synchronizeGroup.isSuccess ? synchronizeGroup.data : null;
  const message = synchronize.error?.message ?? synchronizeGroup.error?.message ?? queryError?.message ?? (
    lastSync ? 'Sent ' + lastSync.sent + ', failed ' + lastSync.failed.length : ''
  );

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div><h1>Offline Requests</h1><p>{requests.filter(item => item.status === 'Pending').length} pending</p></div>
          <div className="actions">
            <span className={'status ' + (serviceOnline ? 'online' : 'offline')}>
              {serviceOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              {health.isPending ? 'Checking service...' : serviceOnline ? 'Sync service online' : 'Sync service offline'}
            </span>
            <button type="button" disabled={requestsQuery.isFetching} aria-label="Refresh" title="Refresh"
              onClick={() => { synchronize.reset(); void client.invalidateQueries({ queryKey: localKeys.all }); }}>
              <RefreshCw size={18} />
            </button>
            <button type="button" className="primary" disabled={synchronize.isPending} title="Sync pending requests"
              onClick={() => synchronize.mutate()}>
              <Send size={18} />{synchronize.isPending ? 'Sending...' : 'Sync'}
            </button>
          </div>
        </header>
        {message && <p role={synchronize.error || synchronizeGroup.error || queryError ? 'alert' : 'status'} className="feedback">{message}</p>}
        <section className="content-grid">
          <RequestForm processors={processorsQuery.data ?? []} pending={create.isPending}
            onCreate={create.mutateAsync} onCreated={request => { setSelectedId(request.id); synchronize.reset(); }} />
          <RequestList requests={requests} selectedId={selected?.id} loading={requestsQuery.isPending} onSelect={setSelectedId} />
          <RequestDetail request={selected} />
        </section>
        <GroupPanel groups={groups} requests={requests} totals={totals}
          loading={groupsQuery.isPending} creating={createGroup.isPending}
          syncingId={synchronizeGroup.isPending ? synchronizeGroup.variables : null}
          onCreate={createGroup.mutateAsync}
          onSynchronize={id => { synchronize.reset(); synchronizeGroup.mutate(id); }} />
      </section>
    </main>
  );
}
