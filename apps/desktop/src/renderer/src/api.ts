import type { TimeStopApi } from '@time-stop/domain';

/** The only door out of the renderer; the preload puts an IPC-backed `TimeStopApi` here. */
export function api(): TimeStopApi {
  return window.timeStop;
}
