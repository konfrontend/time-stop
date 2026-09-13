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
import type { DashboardRow, Record, Rounding } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
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
import { ProjectDot } from '@/components/ProjectDot';

interface TableContextValue {
  now: number;
  rounding: Rounding;
  // The Record whose Name opens for editing on mount, once.
  editing: string | null;
  onEditing: (recordId: string | null) => void;
  onOpen: (record: Record) => void;
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
  // Id of the Record whose Name should open for editing; cleared through `onEditing`.
  editing: string | null;
  onEditing: (recordId: string | null) => void;
  onAdd: (day: string) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
  onOpen: (record: Record) => void;
  onRename: (record: Record, name: string) => void;
  onDelete: (record: Record) => void;
}

/**
 * Three columns of two-line cells: select, Record (Name over Project · Client · Limits) and
 * time (Duration and Amount over the span). Rows group under day headers, each with a hover
 * `+ new` that adds a Record to that day.
 */
export function DashboardTable({
  rows,
  loaded,
  today,
  now,
  rounding,
  editing,
  onEditing,
  onAdd,
  rowSelection,
  onRowSelectionChange,
  onOpen,
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
  const context = useMemo(
    () => ({ now, rounding, editing, onEditing, onOpen, onRename, onDelete }),
    [now, rounding, editing, onEditing, onOpen, onRename, onDelete],
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
                className="h-5 px-1 text-muted-foreground opacity-0 group-focus-within/day:opacity-100 group-hover/day:opacity-100 focus-visible:opacity-100"
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

/** A Record with its right-click menu; Delete confirms in a Popover over the row. */
function RecordRow({ table, row }: { table: TableInstance; row: TableRowModel }) {
  const { onOpen, onDelete } = useTableContext();
  const { record } = row.original;
  const [confirming, setConfirming] = useState(false);
  // The confirmation opens once the menu has closed, or the menu's teardown dismisses it.
  const askOnClose = useRef(false);
  return (
    <Popover open={confirming} onOpenChange={setConfirming}>
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
            if (!askOnClose.current) return;
            askOnClose.current = false;
            event.preventDefault();
            setConfirming(true);
          }}
        >
          <ContextMenuItem onSelect={() => onOpen(record)}>
            <Pencil />
            Edit…
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={record.stop === null}
            onSelect={() => {
              askOnClose.current = true;
            }}
          >
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <PopoverContent align="end" className="w-56" data-slot="delete-confirm">
        <p className="text-sm font-medium">Delete this Record?</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirming(false);
              onDelete(record);
            }}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
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
        {project ? (
          <>
            <ProjectDot project={project} />
            <span className="truncate">
              {project.name}
              {client ? ` · ${client.name}` : ''}
            </span>
          </>
        ) : null}
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
  const { now, rounding, onOpen } = useTableContext();
  const { record, currency } = row;
  const hours = hoursOf(record, now, rounding);
  const amount = amountOf(row, hours);
  return (
    <button
      type="button"
      aria-label="Edit Record"
      data-slot="record-time"
      className="flex w-full flex-col items-end gap-0.5 rounded-sm text-right outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => onOpen(record)}
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
