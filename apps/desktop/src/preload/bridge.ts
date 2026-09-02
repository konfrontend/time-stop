/**
 * The surface the renderer sees on `window.timeStop`. Every member is added here first, then
 * implemented in `index.ts` over IPC; the renderer never imports from Electron.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- grows as IPC calls are added
export interface TimeStopBridge {}
