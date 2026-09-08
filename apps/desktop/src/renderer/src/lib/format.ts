import type { LimitsUsage, Period } from '@time-stop/domain';

const pad = (n: number) => String(n).padStart(2, '0');

export function hoursText(ms: number): string {
  return `${(Math.max(0, ms) / 3_600_000).toFixed(2)} h`;
}

export function dayBounds(ms: number): { from: number; to: number } {
  const from = new Date(ms);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.getTime(), to: to.getTime() };
}

export function recordsWarning(count: number, what: string): string {
  if (count === 0) return `${what} has no Records.`;
  const records = count === 1 ? '1 Record' : `${count} Records`;
  return `${what} still holds ${records}.`;
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function hoursMinutes(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function money(currency: string, amount: number): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function dayLabel(dayStartMs: number, todayStartMs: number): string {
  const days = Math.round((todayStartMs - dayStartMs) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(dayStartMs).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function rangeLabel(period: Period, from: number, to: number): string {
  if (period === 'month') {
    return new Date(from).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const day = { day: 'numeric', month: 'short' } as const;
  return `${new Date(from).toLocaleDateString(undefined, day)} – ${new Date(to - 1).toLocaleDateString(undefined, day)}`;
}

/** "5.0 of 2–4 h" for a Project with Min and Max; "≥ 10 h" or "≤ 40 h" with one of them. */
export function limitsText(usage: Pick<LimitsUsage, 'usedMs' | 'min' | 'max'>): string {
  const used = (usage.usedMs / 3_600_000).toFixed(1);
  const bounds =
    usage.min !== null && usage.max !== null
      ? `${usage.min}–${usage.max}`
      : usage.min !== null
        ? `≥ ${usage.min}`
        : `≤ ${usage.max}`;
  return `${used} of ${bounds} h`;
}
