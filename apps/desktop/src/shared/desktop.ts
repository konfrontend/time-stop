import type { ApiOf } from '@time-stop/domain';
import { files } from './files';
import { imports } from './imports';
import { release } from './release';
import { shell } from './shell';
import { theme } from './theme';

export const DESKTOP_PREFIX = 'desktop';
export const desktop = { shell, files, imports, release, theme };
export type DesktopApi = ApiOf<typeof desktop>;
