import { createContext, useContext, useMemo, useState } from 'react';
import type React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Sort, SortKey } from '@/lib/dashboardSearch';
import { clock, dayLabel, hoursMinutes, limitsShort, limitsText, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface TableContextValue {
  now: number;
  rounding: Rounding;
  onOpen: (record: Record) => void;
  onRename: (record: Record, name: string) => void;
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
    cell: ({ row }) => <RecordCell row={row.original} />,
  }),
  helper.display({
    id: 'time',
    cell: ({ row }) => <TimeCell row={row.original} />,
  }),
]);

interface DashboardTableProps {
  // Already in display order.
  rows: DashboardRow[];
  loaded: boolean;
  today: string;
  now: number;
  rounding: Rounding;
  sort: Sort;
  onSort: (sort: Sort) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
  onOpen: (record: Record) => void;
  onRename: (record: Record, name: string) => void;
}

/**
 * Three columns of two-line cells: select, Record (Name over Project · Client · Limits) and
 * time (Duration and Amount over the span). Sorted by start the rows group under day headers.
 */
export function DashboardTable({
  rows,
  loaded,
  today,
  now,
  rounding,
  sort,
  onSort,
  rowSelection,
  onRowSelectionChange,
  onOpen,
  onRename,
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
  const grouped = sort.sort === 'start';
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
    () => ({ now, rounding, onOpen, onRename }),
    [now, rounding, onOpen, onRename],
  );

  const toggle = (key: SortKey) =>
    onSort(
      sort.sort === key
        ? { sort: key, dir: sort.dir === 'desc' ? 'asc' : 'desc' }
        : { sort: key, dir: key === 'start' ? 'desc' : 'asc' },
    );

  const body: React.ReactNode[] = [];
  let previousDay: string | null = null;
  for (const row of table.getRowModel().rows) {
    const day = grouped ? dayStart(row.original.record.start) : null;
    if (day !== null && day !== previousDay) {
      body.push(
        <TableRow
          key={`day-${day}`}
          className="bg-muted/60 hover:bg-muted/60"
          data-slot="day-group"
        >
          <TableCell colSpan={3} className="px-3 py-1 text-xs">
            <span className="font-semibold">{dayLabel(day, today)}</span>
            <span className="float-right text-muted-foreground tabular-nums">
              {hoursMinutes(dayHours.get(day) ?? 0)}
            </span>
          </TableCell>
        </TableRow>,
      );
    }
    previousDay = day;
    body.push(
      <TableRow
        key={row.id}
        data-slot="record-row"
        data-running={row.original.record.stop === null || undefined}
        data-state={row.getIsSelected() ? 'selected' : undefined}
        className={cn(row.original.record.stop === null && 'bg-emerald-500/5')}
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
      </TableRow>,
    );
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
                  {header.id === 'select' && <table.FlexRender header={header} />}
                  {header.id === 'record' && (
                    <SortHead
                      label="Record"
                      active={sort.sort === 'name' ? sort.dir : null}
                      onClick={() => toggle('name')}
                    />
                  )}
                  {header.id === 'time' && (
                    <SortHead
                      label="Time"
                      active={sort.sort === 'start' ? sort.dir : null}
                      onClick={() => toggle('start')}
                    />
                  )}
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
            <EmptyDescription>Step the Range, or add one.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </TableContext.Provider>
  );
}

function SortHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: 'asc' | 'desc' | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined}
      onClick={onClick}
    >
      {label}
      {active === 'asc' && <ArrowUp className="size-3" />}
      {active === 'desc' && <ArrowDown className="size-3" />}
    </button>
  );
}

function RecordCell({ row }: { row: DashboardRow }) {
  const { onRename } = useTableContext();
  const { record, project, client, limits } = row;
  const [draft, setDraft] = useState<string | null>(null);

  function save() {
    if (draft !== null && draft.trim() !== record.name) onRename(record, draft.trim());
    setDraft(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {draft === null ? (
        <button
          type="button"
          aria-label="Edit Name"
          data-slot="record-name"
          className="h-5 min-w-0 truncate rounded-sm text-left text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setDraft(record.name)}
        >
          {record.name}
        </button>
      ) : (
        <input
          autoFocus
          aria-label="Name"
          value={draft}
          className="h-5 w-full rounded-sm border-b border-ring bg-transparent text-sm outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            } else if (event.key === 'Escape') {
              setDraft(null);
            }
          }}
        />
      )}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {project ? (
          <>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <span className="truncate">
              {project.name}
              {client ? ` · ${client.name}` : ''}
            </span>
          </>
        ) : (
          <span className="italic">No Project</span>
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
