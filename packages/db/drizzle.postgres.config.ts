import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/postgres/schema.ts',
  out: './drizzle/postgres',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://timestop:timestop@localhost:5432/timestop',
  },
});
