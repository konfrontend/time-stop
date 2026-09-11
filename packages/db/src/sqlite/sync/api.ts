import { serverInputSchema } from '@time-stop/domain';
import type { ServerSettings, TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { readServer, writeServer } from './server.js';

export function syncApi({ db, pusher, require }: ApiContext): TimeStopApi['sync'] {
  function server(): ServerSettings {
    const { url, token } = readServer(db);
    return { url, tokenSet: token !== null, databasePath: db.$client.name };
  }

  return {
    async getServer() {
      require('settings:read');
      return server();
    },
    async setServer(input) {
      require('settings:write');
      // Parsed here as well as at the boundary, so every caller stores one URL shape.
      const { url, token } = serverInputSchema.parse(input);
      const replacement = token === null ? { url } : { url, token };
      db.transaction((tx) => writeServer(tx, replacement));
      // Only a replaced Token clears a halt; a URL edit alone leaves the refusal standing.
      if (token === null) pusher.kick();
      else pusher.resume();
      return server();
    },
    async getStatus() {
      require('settings:read');
      return pusher.status();
    },
    onSyncChanged(listener) {
      return pusher.subscribe(listener);
    },
  };
}
