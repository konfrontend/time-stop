/** Why the last push failed. `auth` and `request` halt the loop; `network` is retried forever. */
export type SyncErrorKind = 'auth' | 'request' | 'network';

export interface SyncError {
  kind: SyncErrorKind;
  message: string;
  at: string;
}

export interface SyncStatus {
  configured: boolean;
  /** Changes still waiting for the Server; they keep queueing while pushing is halted. */
  pending: number;
  lastPushedAt: string | null;
  lastError: SyncError | null;
  /** Pushing stopped until the Owner replaces the Token. */
  halted: boolean;
}

export type SyncListener = (status: SyncStatus) => void;

export interface ServerSettings {
  url: string | null;
  /** The Token itself never leaves the main process; Settings only replaces it. */
  tokenSet: boolean;
  /** Where this Install keeps its database, for the Owner to back up. */
  databasePath: string;
}
