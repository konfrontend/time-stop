import type { WindowMode } from '../../../shared/shell.js';

/** The Tracker fits the compact window; every other tab asks the shell to expand it. */
export function windowModeFor(pathname: string): WindowMode {
  return pathname.startsWith('/tracker') || pathname === '/' ? 'compact' : 'expanded';
}
