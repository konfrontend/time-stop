import { describe, expect, it } from 'vitest';
import { amountOf, isBillable, rateOf } from './money.js';

const billable = { project: { rate: 100 }, currency: 'USD' };

describe('rateOf', () => {
  it('is the Project’s Rate, absent without a Project or a Rate', () => {
    expect(rateOf(billable)).toBe(100);
    expect(rateOf({ project: { rate: null }, currency: 'USD' })).toBeNull();
    expect(rateOf({ project: null, currency: 'USD' })).toBeNull();
  });
});

describe('isBillable', () => {
  it('needs a Rate on the Project and a Currency on the Workspace', () => {
    expect(isBillable(billable)).toBe(true);
    expect(isBillable({ project: { rate: null }, currency: 'USD' })).toBe(false);
    expect(isBillable({ project: { rate: 100 }, currency: null })).toBe(false);
    expect(isBillable({ project: null, currency: 'USD' })).toBe(false);
  });
});

describe('amountOf', () => {
  it('is Rate × hours for a Billable source', () => {
    expect(amountOf(billable, 1.5)).toBe(150);
    expect(amountOf(billable, 0)).toBe(0);
  });

  it('is absent when not Billable', () => {
    expect(amountOf({ project: { rate: 100 }, currency: null }, 2)).toBeNull();
    expect(amountOf({ project: null, currency: 'USD' }, 2)).toBeNull();
  });
});
