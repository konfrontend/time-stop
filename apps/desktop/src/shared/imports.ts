import { z } from 'zod';
import type { MethodTable } from '@time-stop/domain';

export const importTogglInputSchema = z.object({
  workspaceId: z.uuidv7(),
  // The IANA zone the export was written in; Toggl stamps local times without an offset.
  zone: z.string().min(1),
});
export type ImportTogglInput = z.infer<typeof importTogglInputSchema>;

export interface ImportTogglResult {
  filename: string;
  projects: number;
  clients: number;
  records: number;
  skipped: number;
}

export interface ImportsApi {
  // Null when the Owner cancels the file dialog.
  importToggl(input: ImportTogglInput): Promise<ImportTogglResult | null>;
}

export const importsMethods = {
  importToggl: importTogglInputSchema,
} satisfies MethodTable<ImportsApi>;
