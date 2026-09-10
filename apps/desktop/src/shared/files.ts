import { z } from 'zod';
import type { MethodTable } from '@time-stop/domain';

export const saveTextInputSchema = z.object({
  // Offered in the save dialog; the Owner may rename before writing.
  filename: z.string().min(1),
  text: z.string(),
});
export type SaveTextInput = z.infer<typeof saveTextInputSchema>;

export interface FilesApi {
  // False when the Owner cancels the dialog.
  saveText(input: SaveTextInput): Promise<boolean>;
}

export const filesMethods = { saveText: saveTextInputSchema } satisfies MethodTable<FilesApi>;
