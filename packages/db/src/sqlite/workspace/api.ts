import type { Api } from '@app/domain';
import type { ApiContext } from '../ApiContext.js';
import { insertWorkspace, listWorkspaces, removeWorkspace, updateWorkspace } from './rows.js';

export function workspaceApi({
  db,
  identity,
  timestamp,
  commit,
  require,
}: ApiContext): Api['workspace'] {
  return {
    async list() {
      require('workspace:read');
      return listWorkspaces(db);
    },
    async create(input) {
      require('workspace:write');
      return commit((tx) => insertWorkspace(tx, identity, input, timestamp()));
    },
    async update(input) {
      require('workspace:write');
      return commit((tx) => updateWorkspace(tx, identity, input, timestamp()));
    },
    async delete({ id }) {
      require('workspace:write');
      commit((tx) => removeWorkspace(tx, identity, id, timestamp()));
    },
  };
}
