import type { ApiOf } from '@time-stop/domain';
import { files } from './files';
import { imports } from './imports';
import { shell } from './shell';

export const DESKTOP_PREFIX = 'desktop';
export const desktop = { shell, files, imports };
export type DesktopApi = ApiOf<typeof desktop>;
