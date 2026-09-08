export function createPostgresRepository(pool) {
  async function initializeDatabase() {
    await pool.query('CREATE SCHEMA IF NOT EXISTS local');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS local.requests (
        id uuid PRIMARY KEY,
        name varchar(200) NOT NULL,
        type varchar(100) NOT NULL,
        payload text NOT NULL,
        status varchar(20) NOT NULL CHECK (status IN ('Pending', 'Processed', 'Failed')),
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        last_error text NULL
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS ix_local_requests_status ON local.requests (status)');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS local.groups (
        id uuid PRIMARY KEY,
        name varchar(200) NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL
      )
    `);
  }

  const mapRequest = row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    payload: row.payload,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: row.last_error
  });

  const mapGroup = row => ({
    id: row.id,
    name: row.name,
    items: row.items,
    createdAt: row.created_at
  });

  async function listRequests() {
    const result = await pool.query(`
      SELECT id, name, type, payload, status, created_at, updated_at, last_error
      FROM local.requests
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapRequest);
  }

  async function getRequest(id) {
    const result = await pool.query(`
      SELECT id, name, type, payload, status, created_at, updated_at, last_error
      FROM local.requests
      WHERE id = $1
    `, [id]);
    return result.rows[0] ? mapRequest(result.rows[0]) : null;
  }

  async function createLocalRequest(request) {
    const result = await pool.query(`
      INSERT INTO local.requests (id, name, type, payload, status, created_at, updated_at, last_error)
      VALUES ($1, $2, $3, $4, 'Pending', $5, $5, NULL)
      RETURNING id, name, type, payload, status, created_at, updated_at, last_error
    `, [request.id, request.name, request.type, request.payload, request.createdAt]);
    return mapRequest(result.rows[0]);
  }

  async function listPendingRequests(onlyIds = null) {
    const values = onlyIds ? [onlyIds] : [];
    const filter = onlyIds ? 'AND id = ANY($1::uuid[])' : '';
    const result = await pool.query(`
      SELECT id, name, type, payload, status, created_at, updated_at, last_error
      FROM local.requests
      WHERE status = 'Pending' ${filter}
      ORDER BY created_at
    `, values);
    return result.rows.map(mapRequest);
  }

  async function markProcessed(ids) {
    if (ids.length === 0) return;
    await pool.query(`
      UPDATE local.requests
      SET status = 'Processed', updated_at = now(), last_error = NULL
      WHERE id = ANY($1::uuid[])
    `, [ids]);
  }

  async function markFailed(failures) {
    if (failures.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const failure of failures) {
        await client.query(`
          UPDATE local.requests
          SET status = 'Failed', updated_at = now(), last_error = $2
          WHERE id = $1
        `, [failure.id, failure.error]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listGroups() {
    const result = await pool.query(`
      SELECT id, name, items, created_at
      FROM local.groups
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapGroup);
  }

  async function createLocalGroup(group) {
    const result = await pool.query(`
      INSERT INTO local.groups (id, name, items, created_at)
      VALUES ($1, $2, $3::jsonb, $4)
      RETURNING id, name, items, created_at
    `, [group.id, group.name, JSON.stringify(group.items), group.createdAt]);
    return mapGroup(result.rows[0]);
  }

  async function readGroupStore() {
    const [requests, groups] = await Promise.all([listRequests(), listGroups()]);
    return { requests, groups };
  }

  return {
    initializeDatabase, listRequests, getRequest, createLocalRequest,
    listPendingRequests, markProcessed, markFailed, listGroups,
    createLocalGroup, readGroupStore,
    checkHealth: () => pool.query('SELECT 1')
  };
}
