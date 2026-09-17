/** The dozen colors a new Project or Workspace is marked with, one of them picked at random. */
export const PALETTE = [
  '#4f6bd9',
  '#2f9e8f',
  '#d9534f',
  '#e07b39',
  '#8e5bd9',
  '#3aa0e0',
  '#59a14f',
  '#c94f8e',
  '#b5891f',
  '#4a5a6b',
  '#7fb24a',
  '#d94f9e',
] as const;

export const randomColor = (): string => PALETTE[Math.floor(Math.random() * PALETTE.length)]!;

/** The dark foreground and its relative luminance, which `contrastOn` weighs against white. */
const DARK = '#101418';
const LUMINANCE_OF_DARK = 0.0053;

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16) / 255;
const linear = (value: number) =>
  value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/**
 * Near-black or white, whichever reads on a fill of the given color. The two are compared by their
 * WCAG contrast ratio against the fill, so the crossover sits where neither is the better of the
 * two rather than at a hand-set luminance.
 */
export function contrastOn(color: string): string {
  const luminance =
    0.2126 * linear(channel(color, 1)) +
    0.7152 * linear(channel(color, 3)) +
    0.0722 * linear(channel(color, 5));
  const onDark = 1.05 / (luminance + 0.05);
  const onLight = (luminance + 0.05) / (LUMINANCE_OF_DARK + 0.05);
  return onLight >= onDark ? DARK : '#ffffff';
}
