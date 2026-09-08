import type { TimeStopApi } from '@time-stop/domain';
import type { FilesApi } from '../shared/files';
import type { ShellApi } from '../shared/shell';

declare global {
  interface Window {
    timeStop: TimeStopApi;
    files: FilesApi;
    shell: ShellApi;
  }
}

export {};
