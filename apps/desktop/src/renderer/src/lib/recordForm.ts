import { z } from 'zod';
import {
  validateRecordSpan,
  formatClock,
  formatIsoDate,
  isClock,
  parseClock,
  shiftIsoDate,
} from '@app/domain';
import type { Record, UpdateRecordInput } from '@app/domain';

/** Text-field friendly shape of a Record; empty strings stand for "not set". */
export interface RecordFormValues {
  date: string;
  start: string;
  stop: string;
  projectId: string;
  name: string;
}

const clock = (message: string) => z.string().refine(isClock, message);

/**
 * Validates the text values of `original`, or of a new Record without one. The Timer keeps an
 * empty stop, and its start must then not be after `now`.
 */
export function recordFormSchema(original?: Record, now: () => number = Date.now) {
  const running = original?.stop === null;
  return z
    .object({
      date: z.string().min(1, 'Pick a date'),
      start: clock('Enter a start time'),
      stop: running
        ? z.string().refine((s) => s === '' || isClock(s), 'Enter a stop time')
        : clock('Enter a stop time'),
      projectId: z.string(),
      name: z.string().trim().max(500),
    })
    .superRefine((values, ctx) => {
      if (!spanIsParsable(values)) return;
      const fields = toRecordFields(values, original);
      validateRecordSpan(fields, ctx);
      if (running && fields.stop === null && Date.parse(fields.start) > now()) {
        ctx.addIssue({ code: 'custom', path: ['start'], message: 'Start must not be after now' });
      }
    });
}

const spanIsParsable = (values: RecordFormValues) =>
  values.date !== '' && isClock(values.start) && (values.stop === '' || isClock(values.stop));

/**
 * The fields the text values stand for. A clock shows minutes only, so a clock that still reads
 * as `original` does keeps the seconds of `original`. The form has one date, the start's: the stop
 * of a Record that crosses midnight stays on the next day while its clock precedes the start's.
 */
export function toRecordFields(
  values: RecordFormValues,
  original?: Record,
): Omit<UpdateRecordInput, 'id'> {
  const start = resolveClock(values.date, values.start, original?.start);
  return {
    projectId: values.projectId || null,
    name: values.name.trim(),
    start,
    stop: values.stop === '' ? null : resolveStop(values, start, original),
  };
}

function resolveStop(values: RecordFormValues, start: string, original?: Record): string {
  const saved = original?.stop ?? undefined;
  const stop = resolveClock(values.date, values.stop, saved);
  const overnight =
    original !== undefined &&
    saved !== undefined &&
    formatIsoDate(original.start) !== formatIsoDate(saved);
  if (!overnight || stop >= start) return stop;
  return resolveClock(shiftIsoDate(values.date, 1), values.stop, saved);
}

function resolveClock(date: string, clock: string, saved?: string): string {
  const minute = parseClock(date, clock);
  if (saved === undefined || clock !== formatClock(saved)) return minute;
  return new Date(Date.parse(minute) + (Date.parse(saved) % 60_000)).toISOString();
}

type Seed = { record: Record } | { day: string; projectId: string | null };

export function recordFormValues(seed: Seed): RecordFormValues {
  if ('record' in seed) {
    const { record } = seed;
    return {
      date: formatIsoDate(record.start),
      start: formatClock(record.start),
      stop: record.stop === null ? '' : formatClock(record.stop),
      projectId: record.projectId ?? '',
      name: record.name,
    };
  }
  return {
    date: formatIsoDate(seed.day),
    start: '',
    stop: '',
    projectId: seed.projectId ?? '',
    name: '',
  };
}
