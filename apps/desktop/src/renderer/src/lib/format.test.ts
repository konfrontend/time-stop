import { describe, expect, it } from 'vitest';
import {
  dayBounds,
  dayLabel,
  hoursMinutes,
  hoursText,
  limitsText,
  money,
  rangeLabel,
} from './format';

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

describe('hoursMinutes', () => {
  it('shows h:mm without seconds', () => {
    expect(hoursMinutes(90 * 60_000 + 59_000)).toBe('1:30');
    expect(hoursMinutes(0)).toBe('0:00');
  });
});

describe('money', () => {
  it('shows two decimals and the Currency', () => {
    expect(money('USD', 1234.5)).toMatch(/1.?234\.50 USD/);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then dates', () => {
    const today = new Date(2026, 8, 6).getTime();
    const day = 86_400_000;
    expect(dayLabel(today, today)).toBe('Today');
    expect(dayLabel(today - day, today)).toBe('Yesterday');
    expect(dayLabel(today - 2 * day, today)).toMatch(/Sep/);
  });
});

describe('rangeLabel', () => {
  it('names a month, or a week by its first and last day', () => {
    const from = new Date(2026, 8, 1).getTime();
    expect(rangeLabel('month', from, new Date(2026, 9, 1).getTime())).toBe('September 2026');
    expect(rangeLabel('week', from, new Date(2026, 8, 8).getTime())).toMatch(/1.*–.*7/);
  });
});

describe('limitsText', () => {
  it('shows used hours against Min and Max', () => {
    expect(limitsText({ usedMs: 5 * 3_600_000, min: 2, max: 4 })).toBe('5.0 of 2–4 h');
    expect(limitsText({ usedMs: 0, min: 10, max: null })).toBe('0.0 of ≥ 10 h');
    expect(limitsText({ usedMs: 3_600_000, min: null, max: 40 })).toBe('1.0 of ≤ 40 h');
  });
});
