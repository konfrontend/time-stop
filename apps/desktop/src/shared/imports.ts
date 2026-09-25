import { z } from 'zod';
import { method, type } from '@app/domain';

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

export const imports = {
  // Null when the Owner cancels the file dialog.
  importToggl: method({ input: importTogglInputSchema, output: type<ImportTogglResult | null>() }),
};
