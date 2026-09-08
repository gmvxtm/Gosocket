export function countRequestsInGroup(store, groupId, visited = new Set()) {
  if (visited.has(groupId)) {
    throw new Error(`Circular group reference detected at ${groupId}`);
  }

  const group = store.groups.find(item => item.id === groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }

  visited.add(groupId);

  return group.items.reduce((total, item) => {
    if (item.kind === 'request') return total + 1;
    if (item.kind === 'group') return total + countRequestsInGroup(store, item.id, visited);
    return total;
  }, 0);
}

export function requestIdsInGroup(store, groupId, visited = new Set()) {
  if (visited.has(groupId)) {
    throw new Error(`Circular group reference detected at ${groupId}`);
  }

  const group = store.groups.find(item => item.id === groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }

  visited.add(groupId);

  return group.items.flatMap(item => {
    if (item.kind === 'request') return [item.id];
    if (item.kind === 'group') return requestIdsInGroup(store, item.id, visited);
    return [];
  });
}
