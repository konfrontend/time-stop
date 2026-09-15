import { method, type } from '../api/contract.js';
import type { DashboardRow, DashboardView } from './DashboardView.js';
import { dashboardInputSchema, recentRowsInputSchema } from './inputs.js';

export const dashboard = {
  /**
   * Records started in the Range that pass the filters, with Client, Currency and Limits usage
   * derived, plus totals at the time of the call.
   */
  get: method({ input: dashboardInputSchema, output: type<DashboardView>() }),
  // Newest first.
  recent: method({ input: recentRowsInputSchema, output: type<DashboardRow[]>() }),
};
