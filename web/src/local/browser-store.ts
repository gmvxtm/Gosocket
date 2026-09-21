import {
  UnauthorizedError,
  requestsApi,
  type CreateGroupInput,
  type CreateRequestInput,
  type GroupItem,
  type LocalGroup,
  type LocalRequest,
  type SyncResult
} from '../api';
import { countRequestsInGroup, requestIdsInGroup, type GroupStore } from './groups';
import { readMeta, requestResult, runTransaction, stores, writeMeta } from './indexeddb';
import type { LocalStore } from './store';

interface StoredRequest extends LocalRequest {
  owner: string;
}

interface StoredGroup extends LocalGroup {
  owner: string;
}

// Same limits the service enforces, so a request that is accepted here is accepted there too.
const maxPayloadLength = 64 * 1024;
const maxNameLength = 200;
// The service refuses more than 100 per call; sending half of that keeps the body small.
const batchSize = 50;
const processorsKey = 'processors';

let owner = '';

function currentOwner() {
  if (!owner) throw new Error('There is no signed in account to read the local queue of');
  return owner;
}

/**
 * randomUUID is only exposed in secure contexts, and a phone opening the site over plain http
 * on the local network is not one, so the id falls back to random bytes.
 */
function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > maxNameLength) throw new Error('name must contain 1 to 200 characters');
  return name;
}

function withoutOwner<T extends { owner: string }>(record: T) {
  const { owner: _discarded, ...rest } = record;
  return rest;
}

function byNewestFirst(left: { createdAt: string }, right: { createdAt: string }) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

// Pending work leaves in the order it was created, so the central service receives it that way.
function byOldestFirst(left: { createdAt: string }, right: { createdAt: string }) {
  return Date.parse(left.createdAt) - Date.parse(right.createdAt);
}

function ownedRequests(): Promise<StoredRequest[]> {
  return runTransaction([stores.requests], 'readonly', transaction =>
    requestResult<StoredRequest[]>(transaction.objectStore(stores.requests).index('owner').getAll(currentOwner())));
}

function ownedGroups(): Promise<StoredGroup[]> {
  return runTransaction([stores.groups], 'readonly', transaction =>
    requestResult<StoredGroup[]>(transaction.objectStore(stores.groups).index('owner').getAll(currentOwner())));
}

async function readGroupStore(): Promise<GroupStore> {
  const [requests, groups] = await Promise.all([ownedRequests(), ownedGroups()]);
  return { requests, groups };
}

/** The outcome of a batch is written down before the next one leaves. */
async function recordAnswer(answer: SyncResult) {
  const failures = new Map(answer.failed.map(failure => [failure.id, failure.error]));
  const confirmed = new Set(answer.acknowledgements.map(acknowledgement => acknowledgement.id));
  const updatedAt = new Date().toISOString();

  await runTransaction([stores.requests], 'readwrite', async transaction => {
    const store = transaction.objectStore(stores.requests);
    for (const id of [...confirmed, ...failures.keys()]) {
      const record = await requestResult<StoredRequest | undefined>(store.get(id));
      if (!record) continue;
      const processed = confirmed.has(id);
      await requestResult(store.put({
        ...record,
        status: processed ? 'Processed' : 'Failed',
        lastError: processed ? null : failures.get(id) ?? null,
        updatedAt
      }));
    }
  });
}

async function send(pending: StoredRequest[]): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: [], acknowledgements: [] };
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const answer = await requestsApi.syncBatch(pending.slice(offset, offset + batchSize).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      payload: item.payload,
      createdAt: item.createdAt
    })));
    // An outage in a later batch must not undo what the central service already confirmed.
    await recordAnswer(answer);
    result.sent += answer.sent;
    result.failed.push(...answer.failed);
    result.acknowledgements.push(...answer.acknowledgements);
  }
  return result;
}

async function knownProcessors() {
  return (await readMeta<string[]>(processorsKey)) ?? [];
}

/** The queue lives in IndexedDB; the service is only needed to synchronize. */
export const browserStore: LocalStore = {
  mode: 'browser',

  setOwner(username: string) {
    owner = username;
  },

  async listProcessors(signal?: AbortSignal) {
    try {
      const types = await requestsApi.processors(signal);
      await writeMeta(processorsKey, types);
      return types;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      // The catalogue only changes when the service is redeployed, so the last one it gave is
      // good enough to keep creating requests while there is no connectivity.
      const cached = await knownProcessors();
      if (cached.length > 0) return cached;
      throw error;
    }
  },

  async listRequests() {
    return (await ownedRequests()).sort(byNewestFirst).map(withoutOwner);
  },

  async createRequest(input: CreateRequestInput) {
    const name = requireName(input.name);
    const type = typeof input.type === 'string' ? input.type.trim() : '';
    const known = await knownProcessors();
    if (!type || (known.length > 0 && !known.includes(type))) throw new Error('Unsupported request type');
    if (typeof input.payload !== 'string' || input.payload.length > maxPayloadLength) {
      throw new Error('payload must be a string of at most 65536 characters');
    }

    const timestamp = new Date().toISOString();
    const record: StoredRequest = {
      id: newId(),
      owner: currentOwner(),
      name,
      type,
      payload: input.payload,
      status: 'Pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastError: null
    };
    await runTransaction([stores.requests], 'readwrite', transaction =>
      requestResult(transaction.objectStore(stores.requests).add(record)));
    return withoutOwner(record);
  },

  async synchronize() {
    return send((await ownedRequests()).filter(item => item.status === 'Pending').sort(byOldestFirst));
  },

  async listGroups() {
    return (await ownedGroups()).sort(byNewestFirst).map(withoutOwner);
  },

  async createGroup(input: CreateGroupInput) {
    const name = requireName(input.name);
    if (!Array.isArray(input.items)) throw new Error('items must be an array');
    const items: GroupItem[] = input.items.map(item => {
      if (!item || !['group', 'request'].includes(item.kind)) throw new Error('Unknown group item kind');
      return { kind: item.kind, id: item.id };
    });

    const group: StoredGroup = { id: newId(), owner: currentOwner(), name, items, createdAt: new Date().toISOString() };
    const store = await readGroupStore();
    // Walking the tree first rejects a cycle or a missing reference before anything is written.
    countRequestsInGroup({ ...store, groups: [...store.groups, group] }, group.id);
    await runTransaction([stores.groups], 'readwrite', transaction =>
      requestResult(transaction.objectStore(stores.groups).add(group)));
    return withoutOwner(group);
  },

  async countGroup(id: string) {
    return { total: countRequestsInGroup(await readGroupStore(), id) };
  },

  async synchronizeGroup(id: string) {
    const store = await readGroupStore();
    const ids = new Set(requestIdsInGroup(store, id));
    const pending = (store.requests as StoredRequest[]).filter(item => ids.has(item.id) && item.status === 'Pending');
    return send(pending.sort(byOldestFirst));
  }
};
