import type { ContextListener, TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { readContext, writeContext } from './rows.js';

export function contextApi(
  { db, commit, require }: ApiContext,
  contextListeners: Set<ContextListener>,
): TimeStopApi['context'] {
  return {
    async get() {
      require('settings:read');
      return readContext(db);
    },
    async set(input) {
      require('settings:write');
      return commit((tx) => writeContext(tx, input));
    },
    onContextChanged(listener) {
      contextListeners.add(listener);
      return () => {
        contextListeners.delete(listener);
      };
    },
  };
}
