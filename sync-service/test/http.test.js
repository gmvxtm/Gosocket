import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { createHttpServer } from '../src/http.js';

const session = { secret: 'clave-de-prueba', issuer: 'request-hub', audience: 'offline-requests' };

function signedToken(overrides = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = {
    sub: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
    unique_name: 'gino',
    displayName: 'Gino Maguina',
    iss: session.issuer,
    aud: session.audience,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  };
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${body}.${createHmac('sha256', session.secret).update(body).digest('base64url')}`;
}

const auth = { authorization: `Bearer ${signedToken()}` };

async function start(t, application) {
  const server = createHttpServer({ application, backendUrl: 'http://central', session, logger: { error() {} } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return 'http://127.0.0.1:' + server.address().port;
}

test('malformed JSON and non-object input return 400', async t => {
  const url = await start(t, {});
  for (const body of ['{invalid', 'null', '[]']) {
    const response = await fetch(url + '/requests', { method: 'POST', body, headers: auth });
    assert.equal(response.status, 400);
  }
});

test('health reflects repository availability', async t => {
  let available = false;
  const url = await start(t, { health: async () => { if (!available) throw new Error('database down'); } });
  assert.equal((await fetch(url + '/health')).status, 503);
  available = true;
  const response = await fetch(url + '/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'Healthy');
});

test('unexpected errors do not expose internal details', async t => {
  const url = await start(t, { listRequests: async () => { throw new Error('private database detail'); } });
  const response = await fetch(url + '/requests', { headers: auth });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unexpected service error' });
});

test('the endpoints require a session, except health and login', async t => {
  const url = await start(t, {
    health: async () => {},
    login: async () => ({ token: 'issued' }),
    listRequests: async () => []
  });

  assert.equal((await fetch(url + '/health')).status, 200);
  assert.equal((await fetch(url + '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'gino', password: 'x' })
  })).status, 200);

  assert.equal((await fetch(url + '/requests')).status, 401);
  assert.equal((await fetch(url + '/requests', { headers: { authorization: 'Bearer roto' } })).status, 401);
  assert.equal((await fetch(url + '/requests', { headers: auth })).status, 200);
});

test('an expired session cannot synchronize', async t => {
  const url = await start(t, { synchronize: async () => ({ sent: 0 }) });
  const expired = { authorization: `Bearer ${signedToken({ exp: Math.floor(Date.now() / 1000) - 3600 })}` };

  const response = await fetch(url + '/sync', { method: 'POST', headers: expired });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Invalid or expired session');
});

test('the session endpoint returns who is signed in', async t => {
  const url = await start(t, {});

  const response = await fetch(url + '/session', { headers: auth });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).username, 'gino');
});

test('the token reaches the synchronization, so it can be forwarded to the backend', async t => {
  let received = null;
  const url = await start(t, { synchronize: async (ids, token) => { received = token; return { sent: 0 }; } });

  await fetch(url + '/sync', { method: 'POST', headers: auth });

  assert.equal(received, auth.authorization.slice(7));
});
