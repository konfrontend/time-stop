import { describe, expect, it, vi } from 'vitest';
import { colorSchema } from '@app/domain';
import { PALETTE, contrastOn, randomColor } from './colors';

describe('PALETTE', () => {
  it('holds a dozen distinct hex colors', () => {
    expect(PALETTE).toHaveLength(12);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    for (const color of PALETTE) expect(colorSchema.safeParse(color).success).toBe(true);
  });
});

describe('randomColor', () => {
  it('picks from the palette', () => {
    expect(PALETTE).toContain(randomColor());
  });

  it('spans the whole palette', () => {
    for (const [index, color] of PALETTE.entries()) {
      vi.spyOn(Math, 'random').mockReturnValue(index / PALETTE.length);
      expect(randomColor()).toBe(color);
    }
    vi.restoreAllMocks();
  });
});

const luminance = (color: string) => {
  const linear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const channel = (at: number) => linear(Number.parseInt(color.slice(at, at + 2), 16) / 255);
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const ratio = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
};

describe('contrastOn', () => {
  it('reads light on a dark fill and dark on a light one', () => {
    expect(contrastOn('#000000')).toBe('#ffffff');
    expect(contrastOn('#4f6bd9')).toBe('#ffffff');
    expect(contrastOn('#ffffff')).toBe('#101418');
    expect(contrastOn('#ffe066')).toBe('#101418');
  });

  it('picks the higher-contrast foreground for every palette color', () => {
    for (const color of PALETTE) {
      const picked = contrastOn(color);
      const other = picked === '#ffffff' ? '#101418' : '#ffffff';
      expect(ratio(picked, color)).toBeGreaterThanOrEqual(ratio(other, color));
    }
  });
});
