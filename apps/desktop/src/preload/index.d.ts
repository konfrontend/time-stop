import type { TimeStopApi } from '@time-stop/domain';
import type { FilesApi } from '../shared/files.js';

declare global {
  interface Window {
    timeStop: TimeStopApi;
    files: FilesApi;
  }
}

export {};
