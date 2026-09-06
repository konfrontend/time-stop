const pad = (n: number) => String(n).padStart(2, '0');

export function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

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
