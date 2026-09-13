import { describe, expect, it } from 'vitest';
import { clockSteps, normaliseClock, nudgeClock } from './clockText';

describe('normaliseClock', () => {
  it('fills in hours and minutes from bare digits', () => {
    expect(normaliseClock('9')).toBe('09:00');
    expect(normaliseClock('930')).toBe('09:30');
    expect(normaliseClock('1730')).toBe('17:30');
    expect(normaliseClock('9.30')).toBe('09:30');
    expect(normaliseClock('09:30')).toBe('09:30');
  });

  it('reads AM and PM', () => {
    expect(normaliseClock('9pm')).toBe('21:00');
    expect(normaliseClock('9:15 p.m.')).toBe('21:15');
    expect(normaliseClock('12am')).toBe('00:00');
    expect(normaliseClock('12 PM')).toBe('12:00');
  });

  it('rejects what is not a clock', () => {
    expect(normaliseClock('')).toBeNull();
    expect(normaliseClock('25')).toBeNull();
    expect(normaliseClock('9:60')).toBeNull();
    expect(normaliseClock('13pm')).toBeNull();
    expect(normaliseClock('noon')).toBeNull();
  });
});

describe('nudgeClock', () => {
  it('moves by minutes and stops at the edges of the day', () => {
    expect(nudgeClock('09:00', 5)).toBe('09:05');
    expect(nudgeClock('09:00', -5)).toBe('08:55');
    expect(nudgeClock('00:02', -5)).toBe('00:00');
    expect(nudgeClock('23:58', 5)).toBe('23:59');
  });
});

describe('clockSteps', () => {
  it('lists the day in steps', () => {
    const steps = clockSteps(15);
    expect(steps).toHaveLength(96);
    expect(steps.slice(0, 3)).toEqual(['00:00', '00:15', '00:30']);
    expect(steps[95]).toBe('23:45');
  });
});
