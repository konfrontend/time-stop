import { formatDuration, recordDurationMs } from '@time-stop/domain';
import type { Record } from '@time-stop/domain';

export const APP_NAME = 'Time Stop';

// Past this the menu bar starts eating the line, so the name is cut short.
const TRAY_LINE_MAX = 24;

export interface TrayNames {
  recordName: string;
  projectName: string | null;
  workspaceName: string;
}

export interface TrayLineInput extends TrayNames {
  timer: Record | null;
  now: number;
}

/** What the tray calls the work at hand: the Record's Name, else its Project, else the Workspace. */
export function trayLabel({ recordName, projectName, workspaceName }: TrayNames): string {
  return recordName.trim() || projectName || workspaceName;
}

function fit(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The tray one-liner: the running Timer, if any, and what is being worked on. */
export function trayLine({ timer, now, ...names }: TrayLineInput): string {
  // Without a Timer there is no Record to name, so the Context speaks for itself.
  const label = trayLabel(timer ? names : { ...names, recordName: '' });
  if (!timer) return fit(label, TRAY_LINE_MAX);
  const elapsed = formatDuration(recordDurationMs(timer, now));
  return `${elapsed} ${fit(label, TRAY_LINE_MAX - elapsed.length - 1)}`;
}

export function windowTitle(timer: Record | null, now: number): string {
  return timer ? `${APP_NAME} — ${formatDuration(recordDurationMs(timer, now))}` : APP_NAME;
}
