import type { TimeStopApi } from '@time-stop/domain';
import type { DesktopApi } from '../shared/desktop';

declare global {
  interface Window {
    timeStop: TimeStopApi;
    desktop: DesktopApi;
  }
}

export {};
