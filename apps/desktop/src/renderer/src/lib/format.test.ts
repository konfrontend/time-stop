import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  hoursMinutes,
  hoursText,
  limitsShort,
  limitsText,
  money,
  projectAbbreviation,
  recordsWarning,
  rangeLabel,
} from './format';

describe('hoursText', () => {
  it('shows decimal hours', () => {
    expect(hoursText(90 * 60_000)).toBe('1.50 h');
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
    const day = (date: number) => new Date(2026, 8, date).toISOString();
    expect(dayLabel(day(6), day(6))).toBe('Today');
    expect(dayLabel(day(5), day(6))).toBe('Yesterday');
    expect(dayLabel(day(4), day(6))).toMatch(/Sep/);
  });
});

describe('rangeLabel', () => {
  it('names a month, or a week by its first and last day', () => {
    const from = new Date(2026, 8, 1).toISOString();
    expect(rangeLabel('month', from, new Date(2026, 9, 1).toISOString())).toBe('September 2026');
    expect(rangeLabel('week', from, new Date(2026, 8, 8).toISOString())).toMatch(/1.*–.*7/);
  });
});

describe('limitsText', () => {
  it('shows used hours against Min and Max', () => {
    expect(limitsText({ usedMs: 5 * 3_600_000, min: 2, max: 4 })).toBe('5.0 of 2–4 h');
    expect(limitsText({ usedMs: 0, min: 10, max: null })).toBe('0.0 of ≥ 10 h');
    expect(limitsText({ usedMs: 3_600_000, min: null, max: 40 })).toBe('1.0 of ≤ 40 h');
  });
});

describe('limitsShort', () => {
  it('compresses used hours and the Limits to one token', () => {
    expect(limitsShort({ usedMs: 5 * 3_600_000, min: 2, max: 4 })).toBe('5/2–4h');
    expect(limitsShort({ usedMs: 90 * 60_000, min: 10, max: null })).toBe('1.5/≥10h');
    expect(limitsShort({ usedMs: 0, min: null, max: 40 })).toBe('0/≤40h');
  });
});

describe('recordsWarning', () => {
  it('names the consequence only when there are Records', () => {
    expect(recordsWarning(0, 'This Project', 'They lose the Project.')).toBe(
      'This Project has no Records.',
    );
    expect(recordsWarning(1, 'This Project', 'They lose the Project.')).toBe(
      'This Project still holds 1 Record. They lose the Project.',
    );
  });
});

describe('projectAbbreviation', () => {
  it('takes the initials of several words, or the head of a single one, three at most', () => {
    expect(projectAbbreviation('Website redesign')).toBe('WR');
    expect(projectAbbreviation('Rust book')).toBe('RB');
    expect(projectAbbreviation('  Acme  API  platform  work ')).toBe('AAP');
    expect(projectAbbreviation('Meditation')).toBe('MED');
    expect(projectAbbreviation('')).toBe('');
  });
});
