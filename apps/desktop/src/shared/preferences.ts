import { z } from 'zod';
import { method, type } from '@time-stop/domain';

/** What the renderer remembers between launches; the window's own preferences live in `shell`. */
export const preferences = {
  isRecentRecordsOpen: method({ output: type<boolean>() }),
  setRecentRecordsOpen: method({ input: z.boolean(), output: type<boolean>() }),
};
