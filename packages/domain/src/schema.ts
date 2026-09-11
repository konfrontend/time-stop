import { z } from 'zod';

export const idSchema = z.uuidv7();
export const epochMs = z.int().nonnegative();

export const idInputSchema = z.object({ id: idSchema });
export type IdInput = z.infer<typeof idInputSchema>;

export const nameSchema = z.string().trim().min(1).max(200);

/** The Range: `from` inclusive, `to` exclusive. */
export const rangeFields = { from: epochMs, to: epochMs };
export const rangeInOrder = (input: { from: number; to: number }) => input.from <= input.to;
