import type { TimeStopApi, TimerListener } from '@time-stop/domain';
import type { ApiContext } from '../ApiContext.js';
import {
  countRecords,
  insertRecord,
  listRecentNames,
  listRecords,
  readTimer,
  removeRecord,
  renameRecord,
  startTimer,
  stopTimer,
  updateRecord,
} from './rows.js';

const RECENT_NAMES = 10;

export function recordApi(
  { db, identity, timestamp, commit, require }: ApiContext,
  timerListeners: Set<TimerListener>,
): TimeStopApi['record'] {
  const { actorId } = identity;
  return {
    async create(input) {
      require('record:write');
      return commit((tx) => insertRecord(tx, identity, input, timestamp()));
    },
    async update(input) {
      require('record:write');
      return commit((tx) => updateRecord(tx, identity, input, timestamp()));
    },
    async delete({ id }) {
      require('record:write');
      commit((tx) => removeRecord(tx, identity, id, timestamp()));
    },
    async list(input) {
      require('record:read');
      return listRecords(db, actorId, input);
    },
    async count(input) {
      require('record:read');
      return countRecords(db, actorId, input);
    },
    async recentNames({ projectId }) {
      require('record:read');
      return listRecentNames(db, actorId, projectId, RECENT_NAMES);
    },
    async startTimer(input) {
      require('record:write');
      return commit((tx) => startTimer(tx, identity, input ?? {}, timestamp()));
    },
    async stopTimer() {
      require('record:write');
      return commit((tx) => {
        const running = readTimer(tx, actorId);
        return running ? stopTimer(tx, identity, running, timestamp()) : null;
      });
    },
    async getTimer() {
      require('record:read');
      return readTimer(db, actorId);
    },
    async updateName({ id, name }) {
      require('record:write');
      return commit((tx) => renameRecord(tx, identity, id, name, timestamp()));
    },
    onTimerChanged(listener) {
      timerListeners.add(listener);
      return () => {
        timerListeners.delete(listener);
      };
    },
  };
}
