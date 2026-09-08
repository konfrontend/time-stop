import { describe, expect, it } from 'vitest';
import { windowModeFor } from './windowMode';

describe('windowModeFor', () => {
  it('keeps the Tracker compact', () => {
    expect(windowModeFor('/tracker')).toBe('compact');
    expect(windowModeFor('/')).toBe('compact');
  });

  it('expands for the Dashboard and Settings', () => {
    expect(windowModeFor('/dashboard')).toBe('expanded');
    expect(windowModeFor('/settings')).toBe('expanded');
  });
});
