import type { Api } from '@app/domain';
import type { ApiContext } from '../ApiContext.js';
import { readDashboard, readRecentRows } from './read.js';

export function dashboardApi({ db, identity, now, require }: ApiContext): Api['dashboard'] {
  return {
    async get(input) {
      require('record:read');
      return readDashboard(db, identity.actorId, input, now());
    },
    async recent(input) {
      require('record:read');
      return readRecentRows(db, identity.actorId, input, now());
    },
  };
}
