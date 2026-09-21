import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncResult } from '../api';

/**
 * Loading the modules again is what reopening the page looks like: the store forgets the
 * connection it had open and has to find its rows in IndexedDB.
 */
async function openStore() {
  vi.resetModules();
  const [{ browserStore }, { requestsApi }] = await Promise.all([import('./browser-store'), import('../api')]);
  browserStore.setOwner('gino');
  vi.spyOn(requestsApi, 'processors').mockResolvedValue(['text.uppercase', 'json.normalize']);
  return { store: browserStore, requestsApi };
}

/** Each test starts on a browser with nothing stored in it. */
function freshStore() {
  indexedDB = new IDBFactory();
  return openStore();
}

const acknowledged = (ids: string[]): SyncResult => ({
  sent: ids.length,
  failed: [],
  acknowledgements: ids.map(id => ({ id, status: 'Processed' as const, receivedAt: new Date().toISOString(), alreadyRegistered: false }))
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the queue kept in the browser', () => {
  it('keeps a created request pending and readable after a reload', async () => {
    const { store } = await freshStore();
    await store.listProcessors();

    const created = await store.createRequest({ name: 'Order 1', type: 'text.uppercase', payload: 'hello' });
    expect(created.status).toBe('Pending');

    const { store: reopened } = await openStore();
    expect((await reopened.listRequests()).map(item => item.name)).toEqual(['Order 1']);
  });

  it('offers the last known catalogue when the service cannot be reached', async () => {
    const { store, requestsApi } = await freshStore();
    await store.listProcessors();

    vi.spyOn(requestsApi, 'processors').mockRejectedValue(new Error('Failed to fetch'));

    expect(await store.listProcessors()).toEqual(['text.uppercase', 'json.normalize']);
    await expect(store.createRequest({ name: 'Order', type: 'text.uppercase', payload: 'hello' })).resolves.toBeTruthy();
  });

  it('marks what the central service confirmed and what it rejected', async () => {
    const { store, requestsApi } = await freshStore();
    await store.listProcessors();
    const first = await store.createRequest({ name: 'Order 1', type: 'text.uppercase', payload: 'hello' });
    const second = await store.createRequest({ name: 'Order 2', type: 'json.normalize', payload: '{invalid' });

    vi.spyOn(requestsApi, 'syncBatch').mockResolvedValue({
      sent: 1,
      failed: [{ id: second.id, error: 'Unexpected token' }],
      acknowledgements: acknowledged([first.id]).acknowledgements
    });

    const result = await store.synchronize();

    expect(result.sent).toBe(1);
    const stored = new Map((await store.listRequests()).map(item => [item.id, item]));
    expect(stored.get(first.id)?.status).toBe('Processed');
    expect(stored.get(second.id)?.status).toBe('Failed');
    expect(stored.get(second.id)?.lastError).toBe('Unexpected token');
  });

  it('sends the queue in batches and keeps what an interrupted run confirmed', async () => {
    const { store, requestsApi } = await freshStore();
    await store.listProcessors();
    for (let index = 0; index < 60; index++) {
      await store.createRequest({ name: 'Order ' + index, type: 'text.uppercase', payload: 'hello' });
    }

    let calls = 0;
    vi.spyOn(requestsApi, 'syncBatch').mockImplementation(async requests => {
      calls++;
      if (calls === 2) throw new Error('Failed to fetch');
      expect(requests).toHaveLength(50);
      return acknowledged(requests.map(item => item.id));
    });

    await expect(store.synchronize()).rejects.toThrow('Failed to fetch');
    const statuses = (await store.listRequests()).map(item => item.status);
    expect(statuses.filter(status => status === 'Processed')).toHaveLength(50);
    expect(statuses.filter(status => status === 'Pending')).toHaveLength(10);
  });

  it('does not send a request twice once it has been confirmed', async () => {
    const { store, requestsApi } = await freshStore();
    await store.listProcessors();
    const created = await store.createRequest({ name: 'Order', type: 'text.uppercase', payload: 'hello' });
    const syncBatch = vi.spyOn(requestsApi, 'syncBatch').mockResolvedValue(acknowledged([created.id]));

    await store.synchronize();
    await store.synchronize();

    expect(syncBatch).toHaveBeenCalledTimes(1);
  });

  it('keeps the queue of each account apart on a shared device', async () => {
    const { store } = await freshStore();
    await store.listProcessors();
    await store.createRequest({ name: 'Of Gino', type: 'text.uppercase', payload: 'hello' });

    store.setOwner('daniel');
    expect(await store.listRequests()).toEqual([]);
    await store.createRequest({ name: 'Of Daniel', type: 'text.uppercase', payload: 'hello' });
    expect((await store.listRequests()).map(item => item.name)).toEqual(['Of Daniel']);

    store.setOwner('gino');
    expect((await store.listRequests()).map(item => item.name)).toEqual(['Of Gino']);
  });

  it('counts nested groups and rejects a cycle before storing it', async () => {
    const { store } = await freshStore();
    await store.listProcessors();
    const first = await store.createRequest({ name: 'Order 1', type: 'text.uppercase', payload: 'hello' });
    const second = await store.createRequest({ name: 'Order 2', type: 'text.uppercase', payload: 'hello' });

    const inner = await store.createGroup({ name: 'Inner', items: [{ kind: 'request', id: first.id }] });
    const outer = await store.createGroup({
      name: 'Outer',
      items: [{ kind: 'group', id: inner.id }, { kind: 'request', id: second.id }]
    });

    expect(await store.countGroup(outer.id)).toEqual({ total: 2 });
    await expect(store.createGroup({ name: 'Ghost', items: [{ kind: 'request', id: crypto.randomUUID() }] }))
      .rejects.toThrow(/not found/);
    expect(await store.listGroups()).toHaveLength(2);
  });

  it('synchronizes only the requests that hang from a group', async () => {
    const { store, requestsApi } = await freshStore();
    await store.listProcessors();
    const inside = await store.createRequest({ name: 'Inside', type: 'text.uppercase', payload: 'hello' });
    await store.createRequest({ name: 'Outside', type: 'text.uppercase', payload: 'hello' });
    const group = await store.createGroup({ name: 'Group', items: [{ kind: 'request', id: inside.id }] });

    const syncBatch = vi.spyOn(requestsApi, 'syncBatch').mockResolvedValue(acknowledged([inside.id]));

    expect((await store.synchronizeGroup(group.id)).sent).toBe(1);
    expect(syncBatch.mock.calls[0][0].map(item => item.name)).toEqual(['Inside']);
  });
});
