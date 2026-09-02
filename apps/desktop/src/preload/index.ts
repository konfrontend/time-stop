import { contextBridge } from 'electron';
import type { TimeStopBridge } from './bridge.js';

/** The bridge starts empty; later tickets add zod-validated IPC calls here. */
const bridge: TimeStopBridge = {};

contextBridge.exposeInMainWorld('timeStop', bridge);
