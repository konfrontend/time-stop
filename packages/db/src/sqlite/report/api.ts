import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { readReport } from './read.js';

export function reportApi({ db, identity, now, require }: ApiContext): TimeStopApi['report'] {
  return {
    async export(input) {
      require('record:read');
      return readReport(db, identity.actorId, input, now());
    },
  };
}
