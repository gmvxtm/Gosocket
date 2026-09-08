export const config = {
  port: Number(process.env.PORT ?? 3001),
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:5080',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/requests_local'
};
