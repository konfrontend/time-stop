import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** CI provides a Postgres service through DATABASE_URL; elsewhere testcontainers starts one. */
export default async function setup(project: TestProject): Promise<(() => Promise<void>) | void> {
  const url = process.env['DATABASE_URL'];
  if (url) {
    project.provide('databaseUrl', url);
    return;
  }
  const container = await new PostgreSqlContainer('postgres:17').start();
  project.provide('databaseUrl', container.getConnectionUri());
  return async () => {
    await container.stop();
  };
}
