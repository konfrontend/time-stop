import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
  type Updater,
} from '@tanstack/react-table';
import {
  amountOf,
  dayStart,
  hoursOf,
  outsideLimits,
  roundDurationMs,
  recordDurationMs,
} from '@time-stop/domain';
import type { DashboardRow, Project, Record, Rounding } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
import { RecordPopover } from '@/components/RecordPopover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { clock, dayLabel, hoursMinutes, limitsShort, limitsText, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RowPopover {
  recordId: string;
  mode: 'edit' | 'delete';
}

interface TableContextValue {
  now: number;
  today: string;
  rounding: Rounding;
  workspaceId: string;
  projects: Project[];
  // The Record whose Name opens for editing on mount, once.
  editing: string | null;
  onEditing: (recordId: string | null) => void;
  // The one row whose Popover is open, and what it shows.
  popover: RowPopover | null;
  onPopover: (popover: RowPopover | null) => void;
  onRename: (record: Record, name: string) => void;
  onDelete: (record: Record) => void;
}

const TableContext = createContext<TableContextValue | null>(null);
const useTableContext = () => useContext(TableContext)!;

const features = tableFeatures({ rowSelectionFeature });
const helper = createColumnHelper<typeof features, DashboardRow>();
const columns = helper.columns([
  helper.display({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select Record"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
      />
    ),
  }),
  helper.display({
    id: 'record',
    header: 'Record',
    cell: ({ row }) => <RecordCell row={row.original} />,
  }),
  helper.display({
    id: 'time',
    header: 'Time',
    cell: ({ row }) => <TimeCell row={row.original} />,
  }),
]);

interface DashboardTableProps {
  // Already in display order: by start, newest first.
  rows: DashboardRow[];
  loaded: boolean;
  today: string;
  now: number;
  rounding: Rounding;
  // The Workspace in view, and its Projects for the Record form.
  workspaceId: string;
  projects: Project[];
  // Id of the Record whose Name should open for editing; cleared through `onEditing`.
  editing: string | null;
  onEditing: (recordId: string | null) => void;
  onAdd: (day: string) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
  onRename: (record: Record, name: string) => void;
  onDelete: (record: Record) => void;
}

/**
 * Three columns of two-line cells: select, Record (Name over Project, Client and Limits) and
 * time (Duration and Amount over the span). Rows group under day headers, each with a hover
 * `+ new` that adds a Record to that day.
 */
export function DashboardTable({
  rows,
  loaded,
  today,
  now,
  rounding,
  workspaceId,
  projects,
  editing,
  onEditing,
  onAdd,
  rowSelection,
  onRowSelectionChange,
  onRename,
  onDelete,
}: DashboardTableProps) {
  const table = useTable(
    {
      features,
      columns,
      data: rows,
      getRowId: (row) => row.record.id,
      enableRowSelection: (row) => row.original.record.stop !== null,
      state: { rowSelection },
      onRowSelectionChange,
    },
    (state) => ({ rowSelection: state.rowSelection }),
  );
  const dayHours = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = dayStart(row.record.start);
      totals.set(
        day,
        (totals.get(day) ?? 0) + roundDurationMs(recordDurationMs(row.record, now), rounding),
      );
    }
    return totals;
  }, [rows, now, rounding]);
  const [popover, setPopover] = useState<RowPopover | null>(null);
  const context = useMemo(
    () => ({
      now,
      today,
      rounding,
      workspaceId,
      projects,
      editing,
      onEditing,
      popover,
      onPopover: setPopover,
      onRename,
      onDelete,
    }),
    [now, today, rounding, workspaceId, projects, editing, onEditing, popover, onRename, onDelete],
  );

  const body: React.ReactNode[] = [];
  let previousDay: string | null = null;
  for (const row of table.getRowModel().rows) {
    const day = dayStart(row.original.record.start);
    if (day !== previousDay) {
      body.push(
        <TableRow
          key={`day-${day}`}
          className="group/day bg-muted/60 hover:bg-muted/60"
          data-slot="day-group"
        >
          <TableCell colSpan={3} className="px-3 py-0.5 text-xs">
            <div className="flex h-6 items-center gap-1">
              <span className="font-semibold">{dayLabel(day, today)}</span>
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Add Record on ${dayLabel(day, today)}`}
                className="h-5 px-1 text-muted-foreground opacity-0 group-focus-within/day:opacity-100 group-hover/day:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                onClick={() => onAdd(day)}
              >
                <Plus />
                new
              </Button>
              <span className="ml-auto text-muted-foreground tabular-nums">
                {hoursMinutes(dayHours.get(day) ?? 0)}
              </span>
            </div>
          </TableCell>
        </TableRow>,
      );
    }
    previousDay = day;
    body.push(<RecordRow key={row.id} table={table} row={row} />);
  }

  return (
    <TableContext.Provider value={context}>
      <Table className="table-fixed" data-slot="dashboard-table">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="hover:bg-transparent">
            {table.getHeaderGroups().map((group) =>
              group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'h-8 text-xs',
                    header.id === 'select' && 'w-8 pl-3',
                    header.id === 'time' && 'w-28 pr-3 text-right',
                  )}
                >
                  <table.FlexRender header={header} />
                </TableHead>
              )),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {loaded && rows.length === 0 && (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyTitle className="text-sm">No Records in this Range</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </TableContext.Provider>
  );
}

type TableInstance = ReturnType<typeof useTable<typeof features, DashboardRow>>;
type TableRowModel = ReturnType<TableInstance['getRowModel']>['rows'][number];

/** A Record with its right-click menu; Edit and the Delete confirm open in a Popover over the row. */
function RecordRow({ table, row }: { table: TableInstance; row: TableRowModel }) {
  const { today, workspaceId, projects, popover, onPopover, onDelete } = useTableContext();
  const { record } = row.original;
  const mode = popover?.recordId === record.id ? popover.mode : null;
  // The Popover opens once the menu has closed, or the menu's teardown dismisses it.
  const openOnClose = useRef<RowPopover['mode'] | null>(null);
  const close = () => onPopover(null);
  return (
    <Popover open={mode !== null} onOpenChange={(open) => !open && close()}>
      <ContextMenu>
        <PopoverAnchor asChild>
          <ContextMenuTrigger asChild>
            <TableRow
              data-slot="record-row"
              data-running={record.stop === null || undefined}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className={cn(record.stop === null && 'bg-emerald-500/5')}
            >
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    'py-1.5 align-top',
                    cell.column.id === 'select' && 'pl-3',
                    cell.column.id === 'record' && 'min-w-0 overflow-hidden',
                    cell.column.id === 'time' && 'pr-3 text-right',
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          </ContextMenuTrigger>
        </PopoverAnchor>
        <ContextMenuContent
          onCloseAutoFocus={(event) => {
            const next = openOnClose.current;
            if (next === null) return;
            openOnClose.current = null;
            event.preventDefault();
            onPopover({ recordId: record.id, mode: next });
          }}
        >
          <ContextMenuItem
            onSelect={() => {
              openOnClose.current = 'edit';
            }}
          >
            <Pencil />
            Edit…
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={record.stop === null}
            onSelect={() => {
              openOnClose.current = 'delete';
            }}
          >
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {mode === 'edit' && (
        <RecordPopover
          record={record}
          workspaceId={workspaceId}
          projects={projects}
          today={today}
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
              onDelete(record);
            },
          }}
        />
      )}
    </Popover>
  );
}

function RecordCell({ row }: { row: DashboardRow }) {
  const { editing, onEditing, onRename } = useTableContext();
  const { record, project, client, limits } = row;
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the input, whose blur must then not save.
  const cancelled = useRef(false);
  const open = draft !== null || editing === record.id;

  function close() {
    cancelled.current = false;
    setDraft(null);
    if (editing === record.id) onEditing(null);
  }

  function save() {
    if (!cancelled.current && draft !== null && draft.trim() !== record.name) {
      onRename(record, draft.trim());
    }
    close();
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {!open ? (
        <button
          type="button"
          aria-label="Edit Name"
          data-slot="record-name"
          className="-mx-1 h-5 min-w-0 truncate rounded-sm px-1 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
          onClick={() => setDraft(record.name)}
        >
          {record.name}
        </button>
      ) : (
        <input
          autoFocus
          aria-label="Name"
          value={draft ?? record.name}
          className="-mx-1 h-5 w-[calc(100%+0.5rem)] rounded-sm border-0 bg-accent px-1 text-sm outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            } else if (event.key === 'Escape') {
              cancelled.current = true;
              close();
            }
          }}
        />
      )}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {project && (
          <ProjectLabel
            project={project}
            suffix={client?.name}
            className="font-medium text-foreground/80"
          />
        )}
        {limits && (
          <span
            data-slot="limits-usage"
            data-outside={outsideLimits(limits) || undefined}
            title={limitsText(limits)}
            className={cn(
              'shrink-0 whitespace-nowrap tabular-nums',
              outsideLimits(limits) && 'font-medium text-destructive',
            )}
          >
            {limitsShort(limits)}
          </span>
        )}
      </div>
    </div>
  );
}

function TimeCell({ row }: { row: DashboardRow }) {
  const { now, rounding, onPopover } = useTableContext();
  const { record, currency } = row;
  const hours = hoursOf(record, now, rounding);
  const amount = amountOf(row, hours);
  return (
    <button
      type="button"
      aria-label="Edit Record"
      data-slot="record-time"
      className="flex w-full flex-col items-end gap-0.5 rounded-sm text-right outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => onPopover({ recordId: record.id, mode: 'edit' })}
    >
      <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
        <b>{hoursMinutes(hours * 3_600_000)}</b>
        {amount !== null && currency !== null && (
          <span className="text-muted-foreground">{money(currency, amount)}</span>
        )}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {clock(record.start)}–{record.stop === null ? 'now' : clock(record.stop)}
      </span>
    </button>
  );
}
