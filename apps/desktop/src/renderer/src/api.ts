import type { TimeStopApi } from '@time-stop/domain';

export function api(): TimeStopApi {
  return window.timeStop;
}
