import pg from 'pg';
import { config } from './config.js';
import { startTelemetry } from './telemetry.js';
import { createPostgresRepository } from './db.js';
import { ProcessorRegistry } from './processors.js';
import { createBackendClient } from './backend-client.js';
import { createApplication } from './application.js';
import { createHttpServer } from './http.js';

const telemetry = startTelemetry({ endpoint: config.otlpEndpoint });

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000
});
pool.on('error', error => console.error({ event: 'database_pool_error', error }));
const repository = createPostgresRepository(pool);
await repository.initializeDatabase();

const application = createApplication({
  repository,
  processors: new ProcessorRegistry(),
  backend: createBackendClient({ baseUrl: config.backendUrl })
});
const server = createHttpServer({ application, backendUrl: config.backendUrl });
server.listen(config.port, config.host, () => {
  console.log('Sync service listening on http://localhost:' + config.port);
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await pool.end();
    await telemetry.shutdown();
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
