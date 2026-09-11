import { GroupPanel } from '../components/GroupPanel';
import {
  useCreateGroup, useGroups, useGroupTotals, useRequests, useSynchronizeGroup
} from '../hooks/useRequests';

export function GroupsPage() {
  const requests = useRequests();
  const groups = useGroups();
  const createGroup = useCreateGroup();
  const synchronizeGroup = useSynchronizeGroup();
  const rows = groups.data ?? [];
  const totals = useGroupTotals(rows.map(group => group.id));

  return (
    <GroupPanel
      groups={rows}
      requests={requests.data ?? []}
      totals={totals}
      loading={groups.isPending}
      creating={createGroup.isPending}
      syncingId={synchronizeGroup.isPending ? synchronizeGroup.variables : null}
      onCreate={createGroup.mutateAsync}
      onSynchronize={id => synchronizeGroup.mutate(id)}
    />
  );
}
