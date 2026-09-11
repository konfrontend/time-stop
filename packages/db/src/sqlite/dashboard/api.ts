import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { readDashboard } from './read.js';

export function dashboardApi({ db, identity, now, require }: ApiContext): TimeStopApi['dashboard'] {
  return {
    async get(input) {
      require('record:read');
      return readDashboard(db, identity.actorId, input, now());
    },
  };
}
