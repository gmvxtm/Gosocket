import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import {
  createLocalGroup,
  createLocalRequest,
  getRequest,
  initializeDatabase,
  listGroups,
  listPendingRequests,
  listRequests,
  markFailed,
  markProcessed,
  readGroupStore
} from './db.js';
import { countRequestsInGroup, requestIdsInGroup } from './groups.js';
import { listProcessorTypes, processPayload } from './processors.js';

const json = (response, status, body) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  response.end(JSON.stringify(body));
};

const readBody = async request => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const notFound = response => json(response, 404, { error: 'Not found' });

async function createRequest(request, response) {
  const body = await readBody(request);
  const now = new Date();
  const entity = {
    id: randomUUID(),
    name: String(body.name ?? '').trim(),
    type: String(body.type ?? '').trim(),
    payload: String(body.payload ?? ''),
    status: 'Pending',
    createdAt: now,
    updatedAt: now,
    lastError: null
  };

  if (!entity.name || !entity.type) {
    return json(response, 400, { error: 'name and type are required' });
  }

  return json(response, 201, await createLocalRequest(entity));
}

async function createGroup(request, response) {
  const body = await readBody(request);
  const group = {
    id: randomUUID(),
    name: String(body.name ?? '').trim(),
    items: Array.isArray(body.items) ? body.items : [],
    createdAt: new Date()
  };

  if (!group.name) {
    return json(response, 400, { error: 'name is required' });
  }

  return json(response, 201, await createLocalGroup(group));
}

async function syncPending(response, onlyIds = null) {
  const pending = await listPendingRequests(onlyIds);
  const processed = [];
  const failed = [];

  for (const item of pending) {
    try {
      processed.push({
        id: item.id,
        name: item.name,
        type: item.type,
        payload: processPayload(item.type, item.payload),
        createdAt: item.createdAt
      });
    } catch (error) {
      failed.push({ id: item.id, error: error.message });
    }
  }

  let acknowledgements = [];
  if (processed.length > 0) {
    const backendResponse = await fetch(`${config.backendUrl}/requests/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(processed)
    });

    if (!backendResponse.ok) {
      const detail = await backendResponse.text();
      throw new Error(`Backend sync failed: ${backendResponse.status} ${detail}`);
    }

    acknowledgements = await backendResponse.json();
  }

  await markProcessed(acknowledgements.map(item => item.id));
  await markFailed(failed);

  return json(response, 200, {
    sent: acknowledgements.length,
    failed,
    acknowledgements
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return json(response, 204, {});

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, 200, {
        status: 'Healthy',
        backendUrl: config.backendUrl,
        database: 'PostgreSQL'
      });
    }

    if (request.method === 'GET' && url.pathname === '/processors') {
      return json(response, 200, listProcessorTypes());
    }

    if (request.method === 'GET' && url.pathname === '/requests') {
      return json(response, 200, await listRequests());
    }

    if (request.method === 'POST' && url.pathname === '/requests') {
      return await createRequest(request, response);
    }

    const requestMatch = url.pathname.match(/^\/requests\/([^/]+)$/);
    if (request.method === 'GET' && requestMatch) {
      const entity = await getRequest(requestMatch[1]);
      return entity ? json(response, 200, entity) : notFound(response);
    }

    if (request.method === 'POST' && url.pathname === '/sync') {
      return await syncPending(response);
    }

    if (request.method === 'GET' && url.pathname === '/groups') {
      return json(response, 200, await listGroups());
    }

    if (request.method === 'POST' && url.pathname === '/groups') {
      return await createGroup(request, response);
    }

    const groupTotalMatch = url.pathname.match(/^\/groups\/([^/]+)\/total$/);
    if (request.method === 'GET' && groupTotalMatch) {
      const store = await readGroupStore();
      return json(response, 200, { total: countRequestsInGroup(store, groupTotalMatch[1]) });
    }

    const groupSyncMatch = url.pathname.match(/^\/groups\/([^/]+)\/sync$/);
    if (request.method === 'POST' && groupSyncMatch) {
      const store = await readGroupStore();
      return await syncPending(response, requestIdsInGroup(store, groupSyncMatch[1]));
    }

    return notFound(response);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
});

await initializeDatabase();

server.listen(config.port, () => {
  console.log(`Sync service listening on http://localhost:${config.port}`);
});
