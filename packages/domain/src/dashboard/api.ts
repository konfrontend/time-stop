import { method, type } from '../api/contract.js';
import type { DashboardView } from './DashboardView.js';
import { dashboardInputSchema } from './inputs.js';

export const dashboard = {
  /**
   * Records started in the Range that pass the filters, with Client, Currency and Limits usage
   * derived, plus totals at the time of the call.
   */
  get: method({ input: dashboardInputSchema, output: type<DashboardView>() }),
};
