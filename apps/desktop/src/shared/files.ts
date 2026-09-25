import { z } from 'zod';
import { method, type } from '@app/domain';

export const saveTextInputSchema = z.object({
  // Offered in the save dialog; the Owner may rename before writing.
  filename: z.string().min(1),
  text: z.string(),
});
export type SaveTextInput = z.infer<typeof saveTextInputSchema>;

export const files = {
  // False when the Owner cancels the dialog.
  saveText: method({ input: saveTextInputSchema, output: type<boolean>() }),
};
