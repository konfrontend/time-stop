/** IPC channel names shared by the main process and the preload; the renderer never sees them. */
export const channels = {
  startTimer: 'timeStop:startTimer',
  stopTimer: 'timeStop:stopTimer',
  getTimer: 'timeStop:getTimer',
  updateRecordName: 'timeStop:updateRecordName',
  listRecords: 'timeStop:listRecords',
  timerChanged: 'timeStop:timerChanged',
} as const;
