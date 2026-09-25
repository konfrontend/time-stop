import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { sqliteSchema, testApi, type TestApi } from '@app/db/testing';
import { api as apiContract } from '@app/domain';
import type { ApiOf, Context, Contract, Record, SyncStatus, Api, Workspace } from '@app/domain';
import { desktop as desktopContract, type DesktopApi } from '../../../shared/desktop';
import type { ThemeMode } from '../../../shared/theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCacheSync } from '@/hooks/cacheSync';

export interface Harness {
  /** The same object as `window.api`, typed, for arranging state through the real rules. */
  api: Api;
  desktop: DesktopApi;
  /** The database, settable clock and change log behind `api`. */
  db: TestApi;
  /** The Workspace `bootstrap` seeds; every fixture hangs off it unless a test says otherwise. */
  workspace: Workspace;
  /** Events no local write raises: in production the main process is what sends these. */
  emit: {
    timerChanged(timer: Record | null): void;
    contextChanged(context: Context): void;
    syncChanged(status: SyncStatus): void;
    themeChanged(isDark: boolean): void;
  };
}

type Listener = (value: never) => void;
type Listeners = Set<Listener>;

interface Emitted {
  timerChanged: Listeners;
  contextChanged: Listeners;
  syncChanged: Listeners;
  themeChanged: Listeners;
}

/**
 * Builds every member a contract declares, so a member added to the contract can never be the one
 * a test forgot to stub. `method` supplies the call behind a method; `listeners` the set an event
 * subscribes into.
 */
function seam<Groups extends Contract>(
  contract: Groups,
  method: (group: string, member: string) => ((input: unknown) => unknown) | undefined,
  listeners: (group: string, member: string) => Listeners,
): ApiOf<Groups> {
  const api: { [group: string]: { [member: string]: unknown } } = {};
  for (const [group, descriptors] of Object.entries(contract)) {
    const members: { [member: string]: unknown } = (api[group] = {});
    for (const [member, descriptor] of Object.entries(descriptors)) {
      if (descriptor.kind === 'method') {
        const call = method(group, member);
        if (call === undefined) throw new Error(`Nothing backs ${group}.${member}`);
        // The IPC handler parses before the api ever sees the input; so does this.
        members[member] = async (input: unknown) =>
          call(descriptor.input === undefined ? input : descriptor.input.parse(input));
      } else {
        const subscribed = listeners(group, member);
        members[member] = (listener: Listener) => {
          subscribed.add(listener);
          return () => subscribed.delete(listener);
        };
      }
    }
  }
  return api as unknown as ApiOf<Groups>;
}

/**
 * What each method of `window.desktop` answers when a test arranges nothing. A setter echoes its
 * input the way the main process does, so a component that reads back what it wrote agrees with
 * itself; every other default is the quiet world: no update, nothing cancelled, a light theme.
 */
const desktopDefaults: { [member: string]: (input: never) => unknown } = {
  'shell.isAlwaysOnTop': () => false,
  'shell.setAlwaysOnTop': (onTop: boolean) => onTop,
  'files.saveText': () => true,
  'imports.importToggl': () => null,
  'preferences.isRecentRecordsOpen': () => true,
  'preferences.setRecentRecordsOpen': (open: boolean) => open,
  'release.getVersion': () => '0.0.0',
  'release.checkForUpdate': () => null,
  'theme.isDark': () => false,
  'theme.getMode': () => 'system',
  'theme.setMode': (mode: ThemeMode) => mode,
};

/** Which set of the harness's own listeners each event of either contract subscribes into. */
const events: { [member: string]: keyof Emitted } = {
  'record.onTimerChanged': 'timerChanged',
  'context.onContextChanged': 'contextChanged',
  'sync.onSyncChanged': 'syncChanged',
  'theme.onChanged': 'themeChanged',
};

function listenersFor(emitted: Emitted, group: string, member: string): Listeners {
  const set = events[`${group}.${member}`];
  if (set === undefined) throw new Error(`No listener set for ${group}.${member}`);
  return emitted[set];
}

export function harness(): Harness {
  const db = testApi();
  const emitted: Emitted = {
    timerChanged: new Set(),
    contextChanged: new Set(),
    syncChanged: new Set(),
    themeChanged: new Set(),
  };

  const api = seam(
    apiContract,
    (group, member) => {
      const groups = db.api as unknown as { [g: string]: { [m: string]: unknown } | undefined };
      const backing = groups[group]?.[member];
      if (typeof backing !== 'function') return undefined;
      return (input) => (backing as (input: unknown) => unknown)(input);
    },
    (group, member) => listenersFor(emitted, group, member),
  );

  // A write publishes through the real api's own listeners; forward them to the harness's sets so
  // a real write and a raised event reach a subscriber by the same path.
  db.api.record.onTimerChanged((timer) => raise(emitted.timerChanged, timer));
  db.api.context.onContextChanged((context) => raise(emitted.contextChanged, context));
  db.api.sync.onSyncChanged((status) => raise(emitted.syncChanged, status));

  const desktop = seam(
    desktopContract,
    (group, member) => {
      const answer = desktopDefaults[`${group}.${member}`];
      if (answer === undefined) throw new Error(`No default for ${group}.${member}`);
      return (input) => answer(input as never);
    },
    (group, member) => listenersFor(emitted, group, member),
  );

  const [workspace] = db.db.select().from(sqliteSchema.workspaces).all() as Workspace[];
  if (workspace === undefined) throw new Error('bootstrap seeded no Workspace');
  Object.assign(window, { api, desktop });

  return {
    api,
    desktop,
    db,
    workspace,
    emit: {
      timerChanged: (timer) => raise(emitted.timerChanged, timer),
      contextChanged: (context) => raise(emitted.contextChanged, context),
      syncChanged: (status) => raise(emitted.syncChanged, status),
      themeChanged: (isDark) => raise(emitted.themeChanged, isDark),
    },
  };
}

function raise<Value>(listeners: Listeners, value: Value): void {
  for (const listener of [...listeners]) (listener as (value: Value) => void)(value);
}

/** Retries would sit between a failed call and the error a test is waiting to see. */
const noRetries = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Stands in for `Layout`, which mounts the same hook above every route. */
function CacheSync({ children }: { children: ReactNode }) {
  useCacheSync();
  return children;
}

/**
 * Renders `ui` under the providers every renderer tree needs; `harness()` has to be up already.
 * The providers go in as the wrapper rather than around `ui`, so `rerender` keeps them.
 */
export function renderWith(ui: ReactNode, queryClient = noRetries()): RenderResult {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CacheSync>
        <TooltipProvider>{children}</TooltipProvider>
      </CacheSync>
    </QueryClientProvider>
  );
  return render(ui, { wrapper });
}
