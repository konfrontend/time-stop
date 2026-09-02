import type { TimeStopBridge } from './bridge.js';

declare global {
  interface Window {
    timeStop: TimeStopBridge;
  }
}

export {};
