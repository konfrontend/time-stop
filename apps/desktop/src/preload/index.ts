import { contextBridge } from 'electron';
import type { TimeStopApi } from './api.js';

const api: TimeStopApi = {};

contextBridge.exposeInMainWorld('timeStop', api);
