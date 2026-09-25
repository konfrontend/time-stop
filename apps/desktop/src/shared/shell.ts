import { z } from 'zod';
import { method, type } from '@app/domain';

export const shell = {
  isAlwaysOnTop: method({ output: type<boolean>() }),
  setAlwaysOnTop: method({ input: z.boolean(), output: type<boolean>() }),
};
