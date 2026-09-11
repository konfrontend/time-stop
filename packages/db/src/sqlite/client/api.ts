import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { insertClient, listClients, removeClient, updateClient } from './rows.js';

export function clientApi({
  db,
  identity,
  now,
  commit,
  require,
}: ApiContext): TimeStopApi['client'] {
  return {
    async list(input = {}) {
      require('client:read');
      return listClients(db, input);
    },
    async create(input) {
      require('client:write');
      return commit((tx) => insertClient(tx, identity, input, now()));
    },
    async update(input) {
      require('client:write');
      return commit((tx) => updateClient(tx, identity, input, now()));
    },
    async delete({ id }) {
      require('client:write');
      commit((tx) => removeClient(tx, identity, id, now()));
    },
  };
}
