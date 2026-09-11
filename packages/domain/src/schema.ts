import { z } from 'zod';

export const idSchema = z.uuidv7();

/** ISO 8601 UTC, fixed width `YYYY-MM-DDTHH:mm:ss.sssZ`, so lexical order is chronological order. */
export const timestampSchema = z.iso.datetime({ precision: 3 });

export const idInputSchema = z.object({ id: idSchema });
export type IdInput = z.infer<typeof idInputSchema>;

export const nameSchema = z.string().trim().min(1).max(200);

/** The Range: `from` inclusive, `to` exclusive. */
export const rangeFields = { from: timestampSchema, to: timestampSchema };
export const rangeInOrder = (input: { from: string; to: string }) => input.from <= input.to;
