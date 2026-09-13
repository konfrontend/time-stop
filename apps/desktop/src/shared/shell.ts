import { z } from 'zod';
import { method, type } from '@time-stop/domain';

export const shell = {
  isAlwaysOnTop: method({ output: type<boolean>() }),
  setAlwaysOnTop: method({ input: z.boolean(), output: type<boolean>() }),
};
