import { client } from '../client/api.js';
import { context } from '../context/api.js';
import { dashboard } from '../dashboard/api.js';
import { project } from '../project/api.js';
import { record } from '../record/api.js';
import { report } from '../report/api.js';
import { sync } from '../sync/api.js';
import { workspace } from '../workspace/api.js';
import { event, method, type, type ApiOf } from './contract.js';

export { event, method, type };
export type { ApiOf, Contract, MethodDescriptor } from './contract.js';

export const TIME_STOP_PREFIX = 'timeStop';
export const timeStop = { workspace, client, project, record, context, dashboard, report, sync };
export type TimeStopApi = ApiOf<typeof timeStop>;
