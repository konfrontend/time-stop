import { z } from 'zod';
import {
  validateRecordSpan,
  formatClock,
  formatIsoDate,
  isClock,
  parseClock,
} from '@time-stop/domain';
import type { Record, UpdateRecordInput } from '@time-stop/domain';

/** Text-field friendly shape of a Record; empty strings stand for "not set". */
export interface RecordFormValues {
  date: string;
  start: string;
  stop: string;
  projectId: string;
  name: string;
}

const clock = (message: string) => z.string().refine(isClock, message);

/** Validates the text values; `running` lets the Timer keep an empty stop. */
export function recordFormSchema(running: boolean) {
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
      if (spanIsParsable(values)) validateRecordSpan(toRecordFields(values), ctx);
    });
}

const spanIsParsable = (values: RecordFormValues) =>
  values.date !== '' && isClock(values.start) && (values.stop === '' || isClock(values.stop));

export function toRecordFields(values: RecordFormValues): Omit<UpdateRecordInput, 'id'> {
  return {
    projectId: values.projectId || null,
    name: values.name.trim(),
    start: parseClock(values.date, values.start),
    stop: values.stop === '' ? null : parseClock(values.date, values.stop),
  };
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
