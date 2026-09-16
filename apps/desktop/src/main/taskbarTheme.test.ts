import { describe, expect, it } from 'vitest';
import { parseTaskbarIsDark } from './taskbarTheme';

const regQuery = (value: string) => `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    SystemUsesLightTheme    REG_DWORD    ${value}
`;

describe('parseTaskbarIsDark', () => {
  it('reads the light taskbar as light and everything else as dark', () => {
    expect(parseTaskbarIsDark(regQuery('0x1'))).toBe(false);
    expect(parseTaskbarIsDark(regQuery('0x0'))).toBe(true);
  });

  it('has no reading when the value is absent', () => {
    expect(
      parseTaskbarIsDark('ERROR: The system was unable to find the specified registry key'),
    ).toBe(null);
    expect(
      parseTaskbarIsDark(regQuery('').replace('SystemUsesLightTheme', 'AppsUseLightTheme')),
    ).toBe(null);
  });
});
