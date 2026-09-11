import type { TimeStopApi } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import { clearContextProject } from '../context/rows.js';
import {
  archiveProject,
  insertProject,
  listProjects,
  removeProject,
  unarchiveProject,
  updateProject,
} from './rows.js';

export function projectApi({
  db,
  identity,
  now,
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
      return commit((tx) => insertProject(tx, identity, input, now()));
    },
    async update(input) {
      require('project:write');
      return commit((tx) => updateProject(tx, identity, input, now()));
    },
    async archive({ id }) {
      require('project:write');
      return commit((tx) => {
        clearContextProject(tx, id);
        return archiveProject(tx, identity, id, now());
      });
    },
    async unarchive({ id }) {
      require('project:write');
      return commit((tx) => unarchiveProject(tx, identity, id, now()));
    },
    async delete({ id }) {
      require('project:write');
      commit((tx) => removeProject(tx, identity, id, now()));
    },
  };
}
