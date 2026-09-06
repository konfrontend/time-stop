import { describe, expect, it } from 'vitest';
import { dayBounds, hms, hoursText } from './format';

describe('hms', () => {
  it('formats hours, minutes and seconds with padding', () => {
    expect(hms(0)).toBe('00:00:00');
    expect(hms(3_661_000)).toBe('01:01:01');
    expect(hms(-5_000)).toBe('00:00:00');
  });
});

describe('hoursText', () => {
  it('shows decimal hours', () => {
    expect(hoursText(90 * 60_000)).toBe('1.50 h');
  });
});

describe('dayBounds', () => {
  it('spans local midnight to the next local midnight', () => {
    const noon = new Date(2026, 8, 6, 12, 30).getTime();
    expect(dayBounds(noon)).toEqual({
      from: new Date(2026, 8, 6).getTime(),
      to: new Date(2026, 8, 7).getTime(),
    });
  });
});
