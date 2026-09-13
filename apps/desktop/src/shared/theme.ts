import { event, method, type } from '@time-stop/domain';

/** Whether the OS appearance is dark; the renderer mirrors it as the `dark` class. */
export const theme = {
  isDark: method({ output: type<boolean>() }),
  onChanged: event<boolean>(),
};
