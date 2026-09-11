import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPostgresRepository } from '../src/db.js';
import { createApplication } from '../src/application.js';
import { ProcessorRegistry } from '../src/processors.js';
import { createBackendClient } from '../src/backend-client.js';

test('PostgreSQL preserves pending work across connections and recovers a lost acknowledgement', {
  skip: process.env.RUN_DB_TESTS !== '1'
}, async () => {
  const connectionString = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/requests_local';
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:5080';
  const firstPool = new pg.Pool({ connectionString });
  let secondPool;
  const ids = [];
  try {
    const firstRepository = createPostgresRepository(firstPool);
    await firstRepository.initializeDatabase();
    const offline = createApplication({
      repository: firstRepository, processors: new ProcessorRegistry(),
      backend: { register: async () => { throw new Error('Central service offline'); } }
    });
    const row = await offline.createRequest({ name: 'Integration recovery', type: 'text.uppercase', payload: 'hello' });
    ids.push(row.id);
    const invalid = await offline.createRequest({ name: 'Integration invalid', type: 'json.normalize', payload: '{invalid' });
    ids.push(invalid.id);
    await assert.rejects(offline.synchronize(ids), /offline/);
    assert.equal((await firstRepository.getRequest(row.id)).status, 'Pending');
    assert.equal((await firstRepository.getRequest(invalid.id)).status, 'Failed');
    await firstPool.end();

    secondPool = new pg.Pool({ connectionString });
    const repository = createPostgresRepository(secondPool);
    assert.equal((await repository.getRequest(row.id)).payload, 'hello');
    // The central API requires a session, so the test signs in the same way the service does.
    const client = createBackendClient({ baseUrl: backendUrl });
    const { token } = await client.login({
      username: process.env.SEED_USERNAME ?? 'admin',
      password: process.env.SEED_PASSWORD ?? 'Admin.12345'
    });
    let loseAcknowledgement = true;
    const online = createApplication({
      repository, processors: new ProcessorRegistry(),
      backend: { register: async batch => {
        const result = await client.register(batch, token);
        if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('Acknowledgement lost'); }
        return result;
      } }
    });
    await assert.rejects(online.synchronize([row.id]), /Acknowledgement lost/);
    assert.equal((await repository.getRequest(row.id)).status, 'Pending');
    const result = await online.synchronize([row.id]);
    assert.equal(result.sent, 1);
    assert.equal(result.acknowledgements[0].alreadyRegistered, true);
    assert.equal((await repository.getRequest(row.id)).status, 'Processed');
    const central = await fetch(backendUrl + '/requests/' + row.id, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(central.status, 200);
    assert.equal((await central.json()).payload, 'HELLO');
  } finally {
    const cleanupPool = secondPool ?? firstPool;
    if (ids.length) await cleanupPool.query('DELETE FROM local.requests WHERE id = ANY($1::uuid[])', [ids]);
    await cleanupPool.end();
  }
});
