import type { Tx } from '../changes.js';
import type { SqliteDb } from '../open.js';
import { readSetting, writeSetting } from '../settings.js';

export const SERVER_URL_KEY = 'serverUrl';
export const SERVER_TOKEN_KEY = 'serverToken';

/** The Server URL and the Token, both plaintext in the settings table. */
export interface ServerConfig {
  url: string | null;
  token: string | null;
}

export function readServer(db: Tx | SqliteDb): ServerConfig {
  return {
    url: readSetting(db, SERVER_URL_KEY),
    token: readSetting(db, SERVER_TOKEN_KEY),
  };
}

/** An absent token leaves the stored one alone; clearing the URL drops the Token with it. */
export function writeServer(
  tx: Tx | SqliteDb,
  input: { url: string | null; token?: string },
): void {
  writeSetting(tx, SERVER_URL_KEY, input.url);
  if (input.url === null) writeSetting(tx, SERVER_TOKEN_KEY, null);
  else if (input.token !== undefined) writeSetting(tx, SERVER_TOKEN_KEY, input.token);
}
