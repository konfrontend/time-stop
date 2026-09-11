import { event, method, type } from '../api/contract.js';
import type { ServerSettings, SyncStatus } from './SyncStatus.js';
import { serverInputSchema } from './inputs.js';

export const sync = {
  getServer: method({ output: type<ServerSettings>() }),
  /** Replacing the Token clears a halt and resumes pushing; an empty URL stops the mirror. */
  setServer: method({ input: serverInputSchema, output: type<ServerSettings>() }),
  getStatus: method({ output: type<SyncStatus>() }),
  // Fires whenever the push state moves: a batch lands, the queue grows, an error arrives.
  onSyncChanged: event<SyncStatus>(),
};
