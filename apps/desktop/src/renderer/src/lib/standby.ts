import { dayStart } from '@time-stop/domain';
import type { DashboardRow } from '@time-stop/domain';
import { activityKey, totalDurationMs } from '@/lib/activities';

/** What the dial holds between Timers. */
export interface StandbyState {
  // The Name typed on the dial; null while it is untouched, so the remembered Record shows through.
  typed: string | null;
  // The Project whose remembered Record Clear let go, until the next Timer starts.
  cleared: { projectId: string | null } | null;
}

export type StandbyAction =
  | { type: 'typed'; draft: string }
  | { type: 'cleared'; projectId: string | null }
  | { type: 'started' }
  | { type: 'stopped' };

export const initialStandby: StandbyState = { typed: null, cleared: null };

/** A Timer starting or stopping settles the draft; only a start forgets what Clear let go. */
export function standbyReducer(state: StandbyState, action: StandbyAction): StandbyState {
  switch (action.type) {
    case 'typed':
      return { ...state, typed: action.draft };
    case 'cleared':
      return { typed: null, cleared: { projectId: action.projectId } };
    case 'started':
      return initialStandby;
    case 'stopped':
      return { ...state, typed: null };
  }
}

export interface StandbyInput {
  // Stopped Records of the Workspace, newest first.
  rows: DashboardRow[];
  // The Project the next Timer lands in: the Context's.
  projectId: string | null;
  state: StandbyState;
  // Start of today, ISO.
  today: string;
  now: number;
}

export interface Standby {
  // What the Name shows: the typed Name, else the remembered Record's.
  name: string;
  // The Record the dial continues; without one it starts something new.
  target: DashboardRow | null;
  // The target activity's total today.
  todayMs: number;
}

/**
 * What the dial offers while no Timer runs. It remembers the latest stopped Record of the
 * Context's Project, named or not, until Clear or the next Timer; a typed Name that names an
 * activity of that Project continues it instead.
 */
export function standbyOf({ rows, projectId, state, today, now }: StandbyInput): Standby {
  const { typed } = state;
  const cleared = state.cleared !== null && state.cleared.projectId === projectId;
  const last = rows[0];
  const remembered = !cleared && last && last.record.projectId === projectId ? last : null;
  const name = typed ?? remembered?.record.name ?? '';
  const wanted = name.trim();
  const target =
    typed === null
      ? remembered
      : wanted
        ? (rows.find((row) => row.record.projectId === projectId && row.record.name === wanted) ??
          null)
        : null;
  if (!target) return { name, target: null, todayMs: 0 };
  const key = activityKey(target.record);
  const todays = rows.filter(
    (row) => activityKey(row.record) === key && dayStart(row.record.start) === today,
  );
  return { name, target, todayMs: totalDurationMs(todays, now) };
}
