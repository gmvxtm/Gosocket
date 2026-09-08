import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHttpServer } from '../src/http.js';

async function start(t, application) {
  const server = createHttpServer({ application, backendUrl: 'http://central', logger: { error() {} } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return 'http://127.0.0.1:' + server.address().port;
}

test('malformed JSON and non-object input return 400', async t => {
  const url = await start(t, {});
  for (const body of ['{invalid', 'null', '[]']) {
    const response = await fetch(url + '/requests', { method: 'POST', body });
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
  const response = await fetch(url + '/requests');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unexpected service error' });
});
