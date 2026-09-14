import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { clearContextProject } from '../context/rows.js';
import {
  archiveProject,
  insertProject,
  listProjects,
  readProject,
  removeProject,
  unarchiveProject,
  updateProject,
} from './rows.js';

export function projectApi({
  db,
  identity,
  timestamp,
  commit,
  require,
}: ApiContext): TimeStopApi['project'] {
  return {
    async list(input = {}) {
      require('project:read');
      return listProjects(db, input);
    },
    async create(input) {
      require('project:write');
      return commit((tx) => insertProject(tx, identity, input, timestamp()));
    },
    async update(input) {
      require('project:write');
      return commit((tx) => {
        if (readProject(tx, input.id).workspaceId !== input.workspaceId) {
          clearContextProject(tx, input.id);
        }
        return updateProject(tx, identity, input, timestamp());
      });
    },
    async archive({ id }) {
      require('project:write');
      return commit((tx) => {
        clearContextProject(tx, id);
        return archiveProject(tx, identity, id, timestamp());
      });
    },
    async unarchive({ id }) {
      require('project:write');
      return commit((tx) => unarchiveProject(tx, identity, id, timestamp()));
    },
    async delete({ id }) {
      require('project:write');
      commit((tx) => removeProject(tx, identity, id, timestamp()));
    },
  };
}
