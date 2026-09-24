import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/postgres/schema.ts',
  out: './drizzle/postgres',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://app:app@localhost:5432/app',
  },
});
