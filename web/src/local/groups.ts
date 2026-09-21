import type { LocalGroup } from '../api';

export interface GroupStore {
  requests: { id: string }[];
  groups: LocalGroup[];
}

interface GroupNode {
  count(): number;
  requestIds(): string[];
}

class RequestLeaf implements GroupNode {
  constructor(private readonly id: string) {}
  count() { return 1; }
  requestIds() { return [this.id]; }
}

class RequestGroup implements GroupNode {
  constructor(private readonly children: GroupNode[]) {}
  count() { return this.children.reduce((total, child) => total + child.count(), 0); }
  requestIds() { return this.children.flatMap(child => child.requestIds()); }
}

/**
 * Same composite the service applies, rebuilt here because with the queue in the browser
 * there is no one else to walk the tree while there is no connectivity.
 */
export function buildRequestGroup(store: GroupStore, groupId: string): GroupNode {
  const groups = new Map(store.groups.map(group => [group.id, group]));
  const requests = new Set(store.requests.map(request => request.id));
  const path = new Set<string>();

  function build(id: string): GroupNode {
    if (path.has(id)) throw new Error('Circular group reference detected at ' + id);
    const group = groups.get(id);
    if (!group) throw new Error('Group not found: ' + id);
    if (!Array.isArray(group.items)) throw new Error('Group items must be an array');

    path.add(id);
    try {
      return new RequestGroup(group.items.map(item => {
        if (item?.kind === 'group') return build(item.id);
        if (item?.kind !== 'request') throw new Error('Unknown group item kind');
        if (!requests.has(item.id)) throw new Error('Request not found: ' + item.id);
        return new RequestLeaf(item.id);
      }));
    } finally {
      // Only ancestors indicate a cycle; shared children in separate branches are valid.
      path.delete(id);
    }
  }

  return build(groupId);
}

export function countRequestsInGroup(store: GroupStore, groupId: string): number {
  return buildRequestGroup(store, groupId).count();
}

export function requestIdsInGroup(store: GroupStore, groupId: string): string[] {
  return [...new Set(buildRequestGroup(store, groupId).requestIds())];
}
