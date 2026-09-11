import type { ApiOf } from './contract.js';
import { client } from './client.js';
import { context } from './context.js';
import { dashboard } from './dashboard.js';
import { project } from './project.js';
import { record } from './record.js';
import { report } from './report.js';
import { sync } from './sync.js';
import { workspace } from './workspace.js';

export const TIME_STOP_PREFIX = 'timeStop';
export const timeStop = { workspace, client, project, record, context, dashboard, report, sync };
export type TimeStopApi = ApiOf<typeof timeStop>;
