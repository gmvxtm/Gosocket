export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Loopback by default; the container opens it to the compose network through HOST.
  host: process.env.HOST ?? '127.0.0.1',
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:5080',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/requests_local',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
  // The same key the central API signs with: this service only verifies, it never issues.
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-signing-key-change-me-please',
  jwtIssuer: process.env.JWT_ISSUER ?? 'request-hub',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'offline-requests'
};
