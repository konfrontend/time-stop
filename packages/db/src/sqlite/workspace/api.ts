import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { insertWorkspace, listWorkspaces, removeWorkspace, updateWorkspace } from './rows.js';

export function workspaceApi({
  db,
  identity,
  now,
  commit,
  require,
}: ApiContext): TimeStopApi['workspace'] {
  return {
    async list() {
      require('workspace:read');
      return listWorkspaces(db);
    },
    async create(input) {
      require('workspace:write');
      return commit((tx) => insertWorkspace(tx, identity, input, now()));
    },
    async update(input) {
      require('workspace:write');
      return commit((tx) => updateWorkspace(tx, identity, input, now()));
    },
    async delete({ id }) {
      require('workspace:write');
      commit((tx) => removeWorkspace(tx, identity, id, now()));
    },
  };
}
