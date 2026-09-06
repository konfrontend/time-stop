import type { TimeStopApi } from '@time-stop/domain';

declare global {
  interface Window {
    timeStop: TimeStopApi;
  }
}

export {};
