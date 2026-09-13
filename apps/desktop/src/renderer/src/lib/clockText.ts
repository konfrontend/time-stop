const pad = (n: number) => String(n).padStart(2, '0');

/** Whether the locale writes wall clocks with AM/PM. */
export function usesTwelveHours(locale?: string): boolean {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
}

/** `HH:mm` in the locale's clock, for display beside the typed value. */
export function clockLabel(clock: string, locale?: string): string {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The `HH:mm` a typed clock means, or null when it means none: `9` → 09:00, `930` and `9.30`
 * → 09:30, `1730` → 17:30, `9pm` and `9 p.m.` → 21:00, `12am` → 00:00.
 */
export function normaliseClock(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') return null;
  const meridiem = /([ap])\.?\s*m?\.?\s*$/.exec(trimmed)?.[1];
  const digits = trimmed.replace(/[ap]\.?\s*m?\.?\s*$/, '').trim();
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(digits);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (meridiem !== undefined) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** The clock `minutes` away, staying within the day. */
export function nudgeClock(clock: string, minutes: number): string {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Every clock of the day at `stepMinutes` intervals, from 00:00. */
export function clockSteps(stepMinutes: number): string[] {
  const steps: string[] = [];
  for (let total = 0; total < 24 * 60; total += stepMinutes) {
    steps.push(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }
  return steps;
}
