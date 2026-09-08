import { randomUUID } from 'node:crypto';
import { ApplicationError } from './errors.js';
import { countRequestsInGroup, requestIdsInGroup } from './groups.js';

const maxPayloadLength = 64 * 1024;
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

export function createApplication({ repository, processors, backend, newId = randomUUID, now = () => new Date() }) {
  let synchronizing = false;

  async function synchronize(onlyIds = null) {
    if (synchronizing) throw new ApplicationError('Synchronization already in progress', 409);
    synchronizing = true;
    try {
      const pending = await repository.listPendingRequests(onlyIds);
      const processed = [];
      const failed = [];
      for (const item of pending) {
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

      // Record deterministic failures even if the central service is unavailable.
      await repository.markFailed(failed);
      const acknowledgements = [];
      for (let offset = 0; offset < processed.length; offset += 500) {
        const acks = await backend.register(processed.slice(offset, offset + 500));
        await repository.markProcessed(acks.map(ack => ack.id));
        acknowledgements.push(...acks);
      }
      return { sent: acknowledgements.length, failed, acknowledgements };
    } finally {
      synchronizing = false;
    }
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
      const type = typeof body.type === 'string' ? body.type.trim() : '';
      if (type.length > 100 || !processors.types().includes(type)) throw new ApplicationError('Unsupported request type');
      if (typeof body.payload !== 'string' || body.payload.length > maxPayloadLength) {
        throw new ApplicationError('payload must be a string of at most 65536 characters');
      }
      return repository.createLocalRequest({ id: newId(), name, type, payload: body.payload, createdAt: now() });
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
    async synchronizeGroup(id) {
      return synchronize(requestIdsInGroup(await repository.readGroupStore(), requireId(id)));
    }
  };
}
