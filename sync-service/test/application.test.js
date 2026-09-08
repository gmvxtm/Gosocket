import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../src/application.js';
import { ProcessorRegistry, defaultProcessors } from '../src/processors.js';

function fixture(items = [], backend = { register: async rows => rows.map(row => ({ id: row.id, status: 'Processed' })) }) {
  const rows = items.map(item => ({ id: randomUUID(), name: 'Order', type: 'text.uppercase', payload: 'hello', status: 'Pending', ...item }));
  const repository = {
    listPendingRequests: async ids => rows.filter(row => row.status === 'Pending' && (ids === null || ids.includes(row.id))),
    markFailed: async failures => failures.forEach(failure => Object.assign(rows.find(row => row.id === failure.id), { status: 'Failed', lastError: failure.error })),
    markProcessed: async ids => rows.filter(row => ids.includes(row.id)).forEach(row => { row.status = 'Processed'; }),
    createLocalRequest: async row => { rows.push({ ...row, status: 'Pending' }); return rows.at(-1); },
    readGroupStore: async () => ({ requests: rows, groups: [] }),
    createLocalGroup: async group => group
  };
  return { rows, repository, app: createApplication({ repository, processors: new ProcessorRegistry(), backend }) };
}

test('new strategies can be injected without modifying synchronization', async () => {
  const { repository, rows } = fixture([{}]);
  rows[0].type = 'text.reverse';
  const app = createApplication({
    repository,
    processors: new ProcessorRegistry([...defaultProcessors, ['text.reverse', text => [...text].reverse().join('')]]),
    backend: { register: async batch => {
      assert.equal(batch[0].payload, 'olleh');
      return [{ id: batch[0].id, status: 'Processed' }];
    } }
  });
  assert.equal((await app.synchronize()).sent, 1);
  assert.equal(rows[0].payload, 'hello');
  assert.equal(rows[0].status, 'Processed');
});

test('deterministic failures persist during an outage and pending rows recover on retry', async () => {
  let unavailable = true;
  const { app, rows } = fixture([{}, { type: 'json.normalize', payload: '{invalid' }], {
    register: async batch => {
      if (unavailable) throw new Error('offline');
      return batch.map(row => ({ id: row.id, status: 'Processed' }));
    }
  });
  await assert.rejects(app.synchronize(), /offline/);
  assert.deepEqual(rows.map(row => row.status), ['Pending', 'Failed']);
  assert.ok(rows[1].lastError);
  unavailable = false;
  assert.equal((await app.synchronize()).sent, 1);
  assert.deepEqual(rows.map(row => row.status), ['Processed', 'Failed']);
});

test('unacknowledged requests stay pending', async () => {
  const { app, rows } = fixture([{}, {}], { register: async batch => [{ id: batch[0].id, status: 'Processed' }] });
  assert.equal((await app.synchronize()).sent, 1);
  assert.deepEqual(rows.map(row => row.status), ['Processed', 'Pending']);
});

test('batches respect the backend limit and retain earlier confirmations on later failure', async () => {
  let calls = 0;
  const { app, rows } = fixture(Array.from({ length: 501 }, () => ({})), {
    register: async batch => {
      calls++;
      if (calls === 2) {
        assert.equal(batch.length, 1);
        throw new Error('offline');
      }
      assert.equal(batch.length, 500);
      return batch.map(row => ({ id: row.id, status: 'Processed' }));
    }
  });
  await assert.rejects(app.synchronize(), /offline/);
  assert.equal(rows.filter(row => row.status === 'Processed').length, 500);
  assert.equal(rows.at(-1).status, 'Pending');
});

test('overlapping synchronizations are rejected and the guard is released afterwards', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { app } = fixture([{}], { register: async batch => { await gate; return batch.map(row => ({ id: row.id })); } });
  const first = app.synchronize();
  await assert.rejects(app.synchronize(), error => error.statusCode === 409);
  release();
  await first;
  assert.equal((await app.synchronize()).sent, 0);
});

test('invalid requests fail before persistence and valid requests start pending', async () => {
  const { app, rows } = fixture();
  assert.throws(() => app.createRequest({ name: ' ', type: 'text.uppercase', payload: '' }), /name/);
  assert.throws(() => app.createRequest({ name: 'Order', type: 'missing', payload: '' }), /type/);
  assert.throws(() => app.createRequest({ name: 'Order', type: 'text.uppercase', payload: null }), /payload/);
  assert.equal(rows.length, 0);
  const created = await app.createRequest({ name: ' Order ', type: 'text.trim', payload: '' });
  assert.equal(created.name, 'Order');
  assert.equal(created.status, 'Pending');
});

test('group validation rejects missing references before persistence', async () => {
  const { app } = fixture();
  await assert.rejects(app.createGroup({ name: 'Group', items: [{ kind: 'request', id: randomUUID() }] }), /not found/);
  await assert.rejects(app.createGroup({ name: 'Group', items: [{ kind: 'group', id: 'invalid' }] }), /Invalid id/);
  assert.deepEqual((await app.createGroup({ name: 'Group', items: [] })).items, []);
});

test('an empty group cannot accidentally synchronize all pending requests', async () => {
  const { app, repository, rows } = fixture([{}]);
  const groupId = randomUUID();
  repository.readGroupStore = async () => ({ requests: rows, groups: [{ id: groupId, items: [] }] });
  assert.equal((await app.synchronizeGroup(groupId)).sent, 0);
  assert.equal(rows[0].status, 'Pending');
});
