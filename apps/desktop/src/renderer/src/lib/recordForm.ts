import { z } from 'zod';
import { checkRecordSpan, formatClock, formatIsoDate, parseClock } from '@time-stop/domain';
import type { Record, UpdateRecordInput } from '@time-stop/domain';

/** Text-field friendly shape of a Record; empty strings stand for "not set". */
export interface RecordFormValues {
  date: string;
  start: string;
  stop: string;
  projectId: string;
  name: string;
  billable: boolean;
}

const CLOCK = /^\d{2}:\d{2}$/;
const clock = (message: string) => z.string().refine((s) => CLOCK.test(s), message);

/** Validates the text values; `running` lets the Timer keep an empty stop. */
export function recordFormSchema(running: boolean) {
  return z
    .object({
      date: z.string().min(1, 'Pick a date'),
      start: clock('Enter a start time'),
      stop: running
        ? z.string().refine((s) => s === '' || CLOCK.test(s), 'Enter a stop time')
        : clock('Enter a stop time'),
      projectId: z.string(),
      name: z.string().trim().max(500),
      billable: z.boolean(),
    })
    .superRefine((values, ctx) => {
      // Field-level issues above already cover an unparsable date or clock.
      if (spanIsParsable(values)) checkRecordSpan(toRecordFields(values), ctx);
    });
}

const spanIsParsable = (values: RecordFormValues) =>
  values.date !== '' && CLOCK.test(values.start) && (values.stop === '' || CLOCK.test(values.stop));

export function toRecordFields(values: RecordFormValues): Omit<UpdateRecordInput, 'id'> {
  return {
    projectId: values.projectId || null,
    name: values.name.trim(),
    start: parseClock(values.date, values.start),
    stop: values.stop === '' ? null : parseClock(values.date, values.stop),
    billable: values.billable,
  };
}

type Seed = { record: Record } | { day: number; projectId: string | null };

export function recordFormValues(seed: Seed): RecordFormValues {
  if ('record' in seed) {
    const { record } = seed;
    return {
      date: formatIsoDate(record.start),
      start: formatClock(record.start),
      stop: record.stop === null ? '' : formatClock(record.stop),
      projectId: record.projectId ?? '',
      name: record.name,
      billable: record.billable,
    };
  }
  return {
    date: formatIsoDate(seed.day),
    start: '',
    stop: '',
    projectId: seed.projectId ?? '',
    name: '',
    billable: false,
  };
}
