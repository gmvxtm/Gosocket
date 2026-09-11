export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Por defecto solo loopback; en contenedor se abre a la red interna con HOST.
  host: process.env.HOST ?? '127.0.0.1',
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:5080',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/requests_local'
};
