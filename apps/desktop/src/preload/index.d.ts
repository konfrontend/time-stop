import type { TimeStopApi } from './api.js';

declare global {
  interface Window {
    timeStop: TimeStopApi;
  }
}

export {};
