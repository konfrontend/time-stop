import type { Api } from '@app/domain';
import type { DesktopApi } from '../shared/desktop';

declare global {
  interface Window {
    api: Api;
    desktop: DesktopApi;
  }
}

export {};
