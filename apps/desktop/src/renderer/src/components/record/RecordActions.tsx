import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Bin1 from '~icons/streamline-ultimate-color/bin-1';
import ButtonPlay1 from '~icons/streamline-ultimate-color/button-play-1';
import Pencil1 from '~icons/streamline-ultimate-color/pencil-1';
import { useQueryClient } from '@tanstack/react-query';
import { acceptsRecords } from '@time-stop/domain';
import type { DashboardRow, Project, Record, UpdateRecordInput } from '@time-stop/domain';
import { RecordPopover } from '@/components/record/RecordPopover';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { useContextQuery } from '@/hooks/useContext';
import { recordsKey, timerKey } from '@/hooks/useTimer';
import { messageOf } from '@/lib/messageOf';

type RecordFields = Omit<UpdateRecordInput, 'id'>;
type PopoverMode = 'edit' | 'delete';

interface Editor {
  recordId: string;
  // `name` is the Name of a just-added Record, open for typing in its row.
  mode: PopoverMode | 'name';
}

export interface RecordActionsValue {
  // The Record whose Name opens for typing: the one `add` just created.
  editing: string | null;
  stopEditing: () => void;
  // Present where the list continues a Record; a failure lands on `RecordFailure`.
  onContinue: ((row: DashboardRow) => void) | undefined;
  // An empty Record on `day` at the current clock, in the Context's Project.
  add: (day: string) => void;
  rename: (record: Record, name: string) => void;
  update: (record: Record, fields: RecordFields) => void;
  /**
   * Stop at the first failure and report it; resolve to the ids written, so the failed and the
   * unreached stay selected.
   */
  moveAll: (records: Record[], projectId: string | null) => Promise<string[]>;
  deleteAll: (records: Record[]) => Promise<string[]>;
  busy: boolean;
}

interface Internal extends RecordActionsValue {
  workspaceId: string | undefined;
  projects: Project[] | undefined;
  today: string;
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  closeEditor: (recordId: string) => void;
  save: (record: Record | undefined, fields: RecordFields) => Promise<void>;
  remove: (record: Record) => Promise<void>;
  removeReported: (record: Record) => void;
  failure: string | null;
}

const RecordActionsContext = createContext<Internal | null>(null);

function useInternal(): Internal {
  const value = useContext(RecordActionsContext);
  if (value === null) throw new Error('Record actions are used outside <RecordActions>');
  return value;
}

// The hook reads the provider's own context, so the two ship together.
// eslint-disable-next-line react-refresh/only-export-components
export function useRecordActions(): RecordActionsValue {
  return useInternal();
}

interface RecordActionsProps {
  // Unknown until the Context loads; nothing is created or edited before then.
  workspaceId: string | undefined;
  projects: Project[] | undefined;
  // Start of today, ISO: the day a new Record lands on.
  today: string;
  onContinue?: ((row: DashboardRow) => Promise<void>) | undefined;
  children: ReactNode;
}

/**
 * Every Record write of a list, its row menu and footer: one open editor at a time, one set of
 * rules and one failure line. A write made from an open form reports to that form instead.
 */
export function RecordActions({
  workspaceId,
  projects,
  today,
  onContinue,
  children,
}: RecordActionsProps) {
  const queryClient = useQueryClient();
  const context = useContextQuery();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Read at call time: a route hands a new function every render, which would rebuild the value.
  const continueRef = useRef(onContinue);
  useLayoutEffect(() => {
    continueRef.current = onContinue;
  });
  const continues = onContinue !== undefined;

  const value = useMemo((): Internal => {
    const closeEditor = (recordId: string) =>
      setEditor((current) => (current?.recordId === recordId ? null : current));
    const api = window.timeStop.record;
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: recordsKey }),
        queryClient.invalidateQueries({ queryKey: timerKey }),
      ]);

    async function write<Result>(task: () => Promise<Result>): Promise<Result> {
      try {
        return await task();
      } finally {
        await refresh();
      }
    }

    function reported(task: () => Promise<unknown>): void {
      setFailure(null);
      write(task).catch((error: unknown) => setFailure(messageOf(error)));
    }

    async function each(records: Record[], task: (record: Record) => Promise<unknown>) {
      setFailure(null);
      setBusy(true);
      const done: string[] = [];
      try {
        for (const record of records) {
          await task(record);
          done.push(record.id);
        }
      } catch (error) {
        setFailure(messageOf(error));
      } finally {
        await refresh().catch(() => {});
        setBusy(false);
      }
      return done;
    }

    const remove = async (record: Record) => {
      if (record.stop === null) throw new Error('The running Timer cannot be deleted');
      await api.delete({ id: record.id });
    };

    return {
      workspaceId,
      projects,
      today,
      editing: editor?.mode === 'name' ? editor.recordId : null,
      stopEditing: () => setEditor((current) => (current?.mode === 'name' ? null : current)),
      onContinue: continues ? (row) => reported(async () => continueRef.current?.(row)) : undefined,
      add: (day) =>
        reported(async () => {
          if (workspaceId === undefined) throw new Error('No Workspace to add the Record to');
          const clock = new Date();
          const start = new Date(day);
          start.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
          const record = await api.create({
            workspaceId,
            projectId: context.data?.projectId ?? null,
            name: '',
            start: start.toISOString(),
            stop: start.toISOString(),
          });
          setEditor({ recordId: record.id, mode: 'name' });
        }),
      rename: (record, name) => reported(() => api.updateName({ id: record.id, name })),
      update: (record, fields) => reported(() => api.update({ id: record.id, ...fields })),
      moveAll: (records, projectId) =>
        each(records, (record) =>
          api.update({
            id: record.id,
            projectId,
            name: record.name,
            start: record.start,
            stop: record.stop,
          }),
        ),
      deleteAll: (records) => each(records, remove),
      busy,
      editor,
      setEditor,
      closeEditor,
      save: (record, fields) =>
        write(async () => {
          if (record) {
            await api.update({ id: record.id, ...fields });
            return;
          }
          if (workspaceId === undefined) throw new Error('No Workspace to add the Record to');
          if (fields.stop === null) throw new Error('Enter a stop time');
          await api.create({ ...fields, stop: fields.stop, workspaceId });
        }),
      remove: (record) => write(() => remove(record)),
      removeReported: (record) => reported(() => remove(record)),
      failure,
    };
  }, [
    queryClient,
    context.data?.projectId,
    workspaceId,
    projects,
    today,
    continues,
    editor,
    failure,
    busy,
  ]);

  return <RecordActionsContext.Provider value={value}>{children}</RecordActionsContext.Provider>;
}

/** The last failure of a write not made from an open form; cleared as the next write starts. */
export function RecordFailure() {
  const { failure } = useInternal();
  if (failure === null) return null;
  return (
    <p
      role="alert"
      data-slot="record-failure"
      className="shrink-0 border-t px-3 py-1.5 text-xs text-destructive"
    >
      {failure}
    </p>
  );
}

/**
 * A row's right-click menu: Continue where the list offers it, Edit, and Delete for a stopped
 * Record. Edit and the Delete confirm open in a Popover anchored to `children`.
 */
export function RecordMenu({ row, children }: { row: DashboardRow; children: ReactElement }) {
  const actions = useInternal();
  const { record } = row;
  const { editor } = actions;
  const mode = editor?.recordId === record.id && editor.mode !== 'name' ? editor.mode : null;
  // The Popover opens once the menu has closed, or the menu's teardown dismisses it.
  const openOnClose = useRef<PopoverMode | null>(null);
  const close = () => actions.closeEditor(record.id);
  const running = record.stop === null;
  return (
    <Popover open={mode !== null} onOpenChange={(open) => !open && close()}>
      <ContextMenu>
        <PopoverAnchor asChild>
          <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        </PopoverAnchor>
        <ContextMenuContent
          onCloseAutoFocus={(event) => {
            const next = openOnClose.current;
            if (next === null) return;
            openOnClose.current = null;
            event.preventDefault();
            actions.setEditor({ recordId: record.id, mode: next });
          }}
        >
          {actions.onContinue && (
            <ContextMenuItem
              disabled={!acceptsRecords(row.project)}
              onSelect={() => actions.onContinue?.(row)}
            >
              <ButtonPlay1 />
              Continue
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => (openOnClose.current = 'edit')}>
            <Pencil1 />
            Edit…
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={running}
            onSelect={() => (openOnClose.current = 'delete')}
          >
            <Bin1 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {mode === 'edit' && actions.workspaceId !== undefined && (
        <RecordPopover
          record={record}
          workspaceId={actions.workspaceId}
          projects={actions.projects ?? []}
          today={actions.today}
          onSave={(fields) => actions.save(record, fields)}
          onDelete={running ? undefined : () => actions.remove(record)}
          onClose={close}
        />
      )}
      {mode === 'delete' && (
        <ConfirmPopover
          data-slot="delete-confirm"
          className="w-56"
          note="Delete this Record?"
          onCancel={close}
          confirm={{
            label: 'Delete',
            variant: 'destructive',
            onConfirm: () => {
              close();
              actions.removeReported(record);
            },
          }}
        />
      )}
    </Popover>
  );
}

interface NewRecordPopoverProps {
  // Its Project and span as clock text.
  defaults: { projectId: string | null; start: string; stop: string };
  onClose: () => void;
}

/** The Record form for a new Record on today, as the content of a Popover. */
export function NewRecordPopover({ defaults, onClose }: NewRecordPopoverProps) {
  const actions = useInternal();
  if (actions.workspaceId === undefined || actions.projects === undefined) return null;
  return (
    <RecordPopover
      record={undefined}
      workspaceId={actions.workspaceId}
      projects={actions.projects}
      today={actions.today}
      defaults={defaults}
      onSave={(fields) => actions.save(undefined, fields)}
      onClose={onClose}
    />
  );
}
