/**
 * The surface the renderer sees on `window.timeStop`. Every member is declared here and
 * implemented in `index.ts` over zod-validated IPC; the renderer never imports from Electron.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- members are IPC calls; none exist yet
export interface TimeStopApi {}
