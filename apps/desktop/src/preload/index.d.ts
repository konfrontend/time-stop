import type { TimeStopApi } from '@time-stop/domain';
import type { FilesApi } from '../shared/files';
import type { ImportsApi } from '../shared/imports';
import type { ShellApi } from '../shared/shell';

declare global {
  interface Window {
    timeStop: TimeStopApi;
    files: FilesApi;
    imports: ImportsApi;
    shell: ShellApi;
  }
}

export {};
