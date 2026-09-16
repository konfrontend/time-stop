import { describe, expect, it } from 'vitest';
import { trayIconName } from './trayIcon';

describe('trayIconName', () => {
  it('takes the template glyph off Windows, whatever the taskbar looks like', () => {
    expect(trayIconName('standby', { platform: 'darwin', taskbarIsDark: true })).toBe(
      'trayStandbyTemplate.png',
    );
    expect(trayIconName('recording', { platform: 'linux', taskbarIsDark: false })).toBe(
      'trayRecordingTemplate.png',
    );
  });

  it('follows the Windows taskbar theme', () => {
    expect(trayIconName('standby', { platform: 'win32', taskbarIsDark: true })).toBe(
      'trayStandbyOnDark.png',
    );
    expect(trayIconName('standby', { platform: 'win32', taskbarIsDark: false })).toBe(
      'trayStandbyOnLight.png',
    );
    expect(trayIconName('recording', { platform: 'win32', taskbarIsDark: true })).toBe(
      'trayRecordingOnDark.png',
    );
  });
});
