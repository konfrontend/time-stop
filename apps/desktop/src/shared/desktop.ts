import type { ApiOf } from '@app/domain';
import { files } from './files';
import { imports } from './imports';
import { preferences } from './preferences';
import { release } from './release';
import { shell } from './shell';
import { theme } from './theme';

export const DESKTOP_PREFIX = 'desktop';
export const desktop = { shell, files, imports, preferences, release, theme };
export type DesktopApi = ApiOf<typeof desktop>;
