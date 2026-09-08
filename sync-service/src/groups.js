import { ApplicationError } from './errors.js';

export class RequestLeaf {
  constructor(id) { this.id = id; }
  count() { return 1; }
  requestIds() { return [this.id]; }
}

export class RequestGroup {
  constructor(id, children) {
    this.id = id;
    this.children = children;
  }

  count() {
    return this.children.reduce((total, child) => total + child.count(), 0);
  }

  requestIds() {
    return this.children.flatMap(child => child.requestIds());
  }
}

export function buildRequestGroup(store, groupId) {
  const groups = new Map(store.groups.map(group => [group.id, group]));
  const requests = new Set(store.requests.map(request => request.id));
  const path = new Set();

  function build(id) {
    if (path.has(id)) throw new ApplicationError('Circular group reference detected at ' + id);
    const group = groups.get(id);
    if (!group) throw new ApplicationError('Group not found: ' + id, 404);
    if (!Array.isArray(group.items)) throw new ApplicationError('Group items must be an array');

    path.add(id);
    try {
      return new RequestGroup(id, group.items.map(item => {
        if (item?.kind === 'group') return build(item.id);
        if (item?.kind !== 'request') throw new ApplicationError('Unknown group item kind');
        if (!requests.has(item.id)) throw new ApplicationError('Request not found: ' + item.id, 404);
        return new RequestLeaf(item.id);
      }));
    } finally {
      // Only ancestors indicate a cycle; shared children in separate branches are valid.
      path.delete(id);
    }
  }

  return build(groupId);
}

export function countRequestsInGroup(store, groupId) {
  return buildRequestGroup(store, groupId).count();
}

export function requestIdsInGroup(store, groupId) {
  return [...new Set(buildRequestGroup(store, groupId).requestIds())];
}
