import type { Api } from '@app/domain';
import type { ApiContext } from '../ApiContext.js';
import { readReport } from './read.js';

export function reportApi({ db, identity, now, require }: ApiContext): Api['report'] {
  return {
    async export(input) {
      require('record:read');
      return readReport(db, identity.actorId, input, now());
    },
  };
}
