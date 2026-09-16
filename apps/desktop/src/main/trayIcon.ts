export type TrayState = 'standby' | 'recording';

export interface TaskbarLook {
  platform: NodeJS.Platform;
  taskbarIsDark: boolean;
}

/**
 * The tray icon carries the status: an open ring on standby, a filled dot while a Timer runs.
 *
 * macOS tints a template image to the menu bar it sits on, so one glyph serves both appearances.
 * Windows draws the PNG as it is, so the taskbar's own theme picks between a light and a dark one.
 */
export function trayIconName(state: TrayState, { platform, taskbarIsDark }: TaskbarLook): string {
  const glyph = state === 'recording' ? 'Recording' : 'Standby';
  if (platform !== 'win32') return `tray${glyph}Template.png`;
  return `tray${glyph}On${taskbarIsDark ? 'Dark' : 'Light'}.png`;
}
