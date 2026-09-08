import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackendClient } from '../src/backend-client.js';

const batch = [{ id: 'r1', payload: 'HELLO' }];
const ack = { id: 'r1', status: 'Processed' };

test('transient failures retry the identical batch with bounded exponential backoff', async () => {
  const bodies = [];
  const delays = [];
  const client = createBackendClient({
    baseUrl: 'http://central',
    wait: async ms => delays.push(ms),
    fetchImpl: async (_url, options) => {
      bodies.push(options.body);
      assert.ok(options.signal instanceof AbortSignal);
      if (bodies.length === 1) throw new TypeError('network failure');
      if (bodies.length === 2) return new Response('', { status: 503 });
      return Response.json([ack]);
    }
  });
  assert.deepEqual(await client.register(batch), [ack]);
  assert.deepEqual(delays, [200, 400]);
  assert.equal(new Set(bodies).size, 1);
});

test('permanent errors do not retry', async () => {
  let calls = 0;
  const client = createBackendClient({
    baseUrl: 'http://central',
    fetchImpl: async () => { calls++; return new Response('', { status: 400 }); }
  });
  await assert.rejects(client.register(batch), error => error.statusCode === 502);
  assert.equal(calls, 1);
});

test('outages terminate after the configured attempt count', async () => {
  let calls = 0;
  const client = createBackendClient({
    baseUrl: 'http://central', wait: async () => {},
    fetchImpl: async () => { calls++; throw new Error('offline'); }
  });
  await assert.rejects(client.register(batch), /offline/);
  assert.equal(calls, 3);
});

for (const invalid of [[{ id: 'foreign', status: 'Processed' }], [ack, ack], [{ id: 'r1', status: 'Failed' }], {}]) {
  test('invalid acknowledgements are rejected: ' + JSON.stringify(invalid), async () => {
    const client = createBackendClient({ baseUrl: 'http://central', fetchImpl: async () => Response.json(invalid) });
    await assert.rejects(client.register(batch), /Invalid backend acknowledgement/);
  });
}

test('a timed out attempt is aborted', async () => {
  const client = createBackendClient({
    baseUrl: 'http://central', timeoutMs: 10, attempts: 1,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json([ack])), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    })
  });
  await assert.rejects(client.register(batch), error => error.statusCode === 502);
});
