import type { TimeStopApi } from '@time-stop/domain';
import type { ShellApi } from '../shared/shell.js';

declare global {
  interface Window {
    timeStop: TimeStopApi;
    shell: ShellApi;
  }
}

export {};
