import { method, type } from '../api/contract.js';
import type { DashboardRow } from './DashboardView.js';
import { dashboardInputSchema, recentRowsInputSchema } from './inputs.js';

export const dashboard = {
  /**
   * Records started in the Range that pass the filters, newest first, with Client, Currency and
   * Limits usage derived.
   */
  get: method({ input: dashboardInputSchema, output: type<DashboardRow[]>() }),
  // Newest first.
  recent: method({ input: recentRowsInputSchema, output: type<DashboardRow[]>() }),
};
