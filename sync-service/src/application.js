import { randomUUID } from 'node:crypto';
import { ApplicationError } from './errors.js';
import { countRequestsInGroup, requestIdsInGroup } from './groups.js';
import { withSpan } from './telemetry.js';

const maxPayloadLength = 64 * 1024;
// A browser sends its queue in chunks; the cap keeps a single body within the reader limit.
const maxItemsPerBatch = 100;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireId(id) {
  if (typeof id !== 'string' || !uuid.test(id)) throw new ApplicationError('Invalid id');
  return id.toLowerCase();
}

function requireName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw new ApplicationError('name must contain 1 to 200 characters');
  }
  return value.trim();
}

function requirePayload(value) {
  if (typeof value !== 'string' || value.length > maxPayloadLength) {
    throw new ApplicationError('payload must be a string of at most 65536 characters');
  }
  return value;
}

function requireCreatedAt(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (Number.isNaN(parsed)) throw new ApplicationError('createdAt must be a date');
  return new Date(parsed);
}

export function createApplication({ repository, processors, backend, newId = randomUUID, now = () => new Date() }) {
  let synchronizing = false;

  function requireType(value) {
    const type = typeof value === 'string' ? value.trim() : '';
    if (type.length > 100 || !processors.types().includes(type)) throw new ApplicationError('Unsupported request type');
    return type;
  }

  // Applying the strategy is the same work whoever kept the queue, so both callers share it.
  function applyProcessors(items) {
    const processed = [];
    const failed = [];
    for (const item of items) {
      try {
        const payload = processors.process(item.type, item.payload);
        if (typeof payload !== 'string' || payload.length > maxPayloadLength) {
          throw new Error('Processed payload must be a string of at most 65536 characters');
        }
        processed.push({ id: item.id, name: item.name, type: item.type, payload, createdAt: item.createdAt });
      } catch (error) {
        failed.push({ id: item.id, error: error.message });
      }
    }
    return { processed, failed };
  }

  // An interrupted run keeps whatever earlier batches already confirmed.
  async function forward(processed, token, onAcknowledged = async () => {}) {
    const acknowledgements = [];
    for (let offset = 0; offset < processed.length; offset += 500) {
      const acks = await backend.register(processed.slice(offset, offset + 500), token);
      await onAcknowledged(acks);
      acknowledgements.push(...acks);
    }
    return acknowledgements;
  }

  async function synchronize(onlyIds = null, token = null) {
    if (synchronizing) throw new ApplicationError('Synchronization already in progress', 409);
    synchronizing = true;
    return withSpan('synchronize', { 'sync.scope': onlyIds ? 'group' : 'all' }, async span => {
    try {
      const pending = await repository.listPendingRequests(onlyIds);
      const { processed, failed } = applyProcessors(pending);

      // Record deterministic failures even if the central service is unavailable.
      await repository.markFailed(failed);
      const acknowledgements = await forward(processed, token, acks => repository.markProcessed(acks.map(ack => ack.id)));
      span.setAttributes({
        'sync.pending': pending.length,
        'sync.sent': acknowledgements.length,
        'sync.failed': failed.length
      });
      return { sent: acknowledgements.length, failed, acknowledgements };
    } finally {
      synchronizing = false;
    }
    });
  }

  // Used by clients that keep their own queue: nothing is stored here, the caller owns the state.
  async function synchronizeBatch(body, token = null) {
    if (!Array.isArray(body?.requests)) throw new ApplicationError('requests must be an array');
    if (body.requests.length > maxItemsPerBatch) {
      throw new ApplicationError(`A batch carries at most ${maxItemsPerBatch} requests`);
    }
    const incoming = body.requests.map(item => ({
      id: requireId(item?.id),
      name: requireName(item?.name),
      // An unknown type is not rejected here: it comes back as a failure for that one request,
      // so a client holding an outdated catalogue still gets an answer for the rest of the batch.
      type: typeof item?.type === 'string' ? item.type.trim().slice(0, 100) : '',
      payload: requirePayload(item?.payload),
      createdAt: requireCreatedAt(item?.createdAt)
    }));

    return withSpan('synchronize', { 'sync.scope': 'batch' }, async span => {
      const { processed, failed } = applyProcessors(incoming);
      const acknowledgements = await forward(processed, token);
      span.setAttributes({
        'sync.pending': incoming.length,
        'sync.sent': acknowledgements.length,
        'sync.failed': failed.length
      });
      return { sent: acknowledgements.length, failed, acknowledgements };
    });
  }

  return {
    health: () => repository.checkHealth(),
    listProcessors: () => processors.types(),
    listRequests: () => repository.listRequests(),
    listGroups: () => repository.listGroups(),
    async getRequest(id) {
      const request = await repository.getRequest(requireId(id));
      if (!request) throw new ApplicationError('Request not found', 404);
      return request;
    },
    createRequest(body) {
      const name = requireName(body.name);
      const type = requireType(body.type);
      const payload = requirePayload(body.payload);
      return repository.createLocalRequest({ id: newId(), name, type, payload, createdAt: now() });
    },
    async createGroup(body) {
      const name = requireName(body.name);
      if (!Array.isArray(body.items)) throw new ApplicationError('items must be an array');
      const items = body.items.map(item => {
        if (!item || !['group', 'request'].includes(item.kind)) throw new ApplicationError('Unknown group item kind');
        return { kind: item.kind, id: requireId(item.id) };
      });
      const group = { id: newId(), name, items, createdAt: now() };
      const store = await repository.readGroupStore();
      countRequestsInGroup({ ...store, groups: [...store.groups, group] }, group.id);
      return repository.createLocalGroup(group);
    },
    async countGroup(id) {
      return { total: countRequestsInGroup(await repository.readGroupStore(), requireId(id)) };
    },
    synchronize,
    synchronizeBatch,
    login(credentials) {
      const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
      const password = typeof credentials?.password === 'string' ? credentials.password : '';
      if (!username || !password) throw new ApplicationError('username and password are required');
      return backend.login({ username, password });
    },
    async synchronizeGroup(id, token = null) {
      return synchronize(requestIdsInGroup(await repository.readGroupStore(), requireId(id)), token);
    }
  };
}
