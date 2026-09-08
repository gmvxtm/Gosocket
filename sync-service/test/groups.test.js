import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestLeaf, RequestGroup, buildRequestGroup, requestIdsInGroup } from '../src/groups.js';

test('leaf and composite expose the same count and requestIds operations', () => {
  const leaf = new RequestLeaf('r1');
  const group = new RequestGroup('g1', [leaf, new RequestGroup('g2', [new RequestLeaf('r2')])]);
  assert.equal(leaf.count(), 1);
  assert.equal(group.count(), 2);
  assert.deepEqual(group.requestIds(), ['r1', 'r2']);
});

test('shared subgroups count occurrences but synchronization deduplicates requests', () => {
  const store = {
    requests: [{ id: 'r1' }],
    groups: [
      { id: 'root', items: [{ kind: 'group', id: 'child' }, { kind: 'group', id: 'child' }] },
      { id: 'child', items: [{ kind: 'request', id: 'r1' }] }
    ]
  };
  assert.equal(buildRequestGroup(store, 'root').count(), 2);
  assert.deepEqual(requestIdsInGroup(store, 'root'), ['r1']);
});

test('real cycles and dangling references are rejected', () => {
  assert.throws(() => buildRequestGroup({ requests: [], groups: [
    { id: 'a', items: [{ kind: 'group', id: 'b' }] },
    { id: 'b', items: [{ kind: 'group', id: 'a' }] }
  ] }, 'a'), /Circular/);
  assert.throws(() => buildRequestGroup({ requests: [], groups: [
    { id: 'a', items: [{ kind: 'request', id: 'missing' }] }
  ] }, 'a'), /Request not found/);
  assert.throws(() => buildRequestGroup({ requests: [], groups: [] }, 'missing'), /Group not found/);
});

test('empty groups are valid and unknown item kinds fail', () => {
  assert.equal(buildRequestGroup({ requests: [], groups: [{ id: 'a', items: [] }] }, 'a').count(), 0);
  assert.throws(() => buildRequestGroup({ requests: [], groups: [
    { id: 'a', items: [{ kind: 'other', id: 'b' }] }
  ] }, 'a'), /Unknown/);
});
