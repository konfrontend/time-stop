import { createContext, useContext, useMemo } from 'react';
import type React from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
  type Updater,
} from '@tanstack/react-table';
import { dayStart, isBillable, outsideLimits } from '@time-stop/domain';
import type { DashboardDay, ShownRow } from '@time-stop/domain';
import { BillableMark } from '@/components/BillableMark';
import { RecordMenu, useRecordActions } from '@/components/record/RecordActions';
import { RecordName } from '@/components/record/RecordName';
import { RecordSpan } from '@/components/record/RecordSpan';
import { ProjectLabel } from '@/components/ProjectLabel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dayLabel, hoursMinutes, limitsShort, limitsText, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface TableContextValue {
  now: number;
  today: string;
  recordHeader: React.ReactNode;
  timeHeader: React.ReactNode;
}

const TableContext = createContext<TableContextValue | null>(null);
const useTableContext = () => useContext(TableContext)!;

const features = tableFeatures({ rowSelectionFeature });
const helper = createColumnHelper<typeof features, ShownRow>();
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
    header: () => <RecordHeader />,
    cell: ({ row }) => <RecordCell row={row.original} />,
  }),
  helper.display({
    id: 'time',
    header: () => <TimeHeader />,
    cell: ({ row }) => <TimeCell row={row.original} />,
  }),
]);

interface DashboardTableProps {
  // In display order: newest day first, newest Record first within it.
  days: DashboardDay[];
  loaded: boolean;
  today: string;
  now: number;
  // What sits beside the Record and Time column titles.
  recordHeader?: React.ReactNode;
  timeHeader?: React.ReactNode;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
}

/**
 * Three columns of two-line cells: select, Record (Name over Project, Client, Billable mark and
 * Limits) and time (Duration and Amount over the span). Rows group under day headers, each with
 * a hover `+ new` that adds a Record to that day.
 */
export function DashboardTable({
  days,
  loaded,
  today,
  now,
  recordHeader,
  timeHeader,
  rowSelection,
  onRowSelectionChange,
}: DashboardTableProps) {
  const { editing, add } = useRecordActions();
  const rows = useMemo(() => days.flatMap((day) => day.rows), [days]);
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
  const context = useMemo(
    () => ({ now, today, recordHeader, timeHeader }),
    [now, today, recordHeader, timeHeader],
  );

  // `editing` is only ever the Record a day's add button just created.
  const added = rows.find(({ record }) => record.id === editing)?.record;
  const addingDay = added && dayStart(added.start);

  const modelRows = new Map(table.getRowModel().rows.map((row) => [row.id, row]));

  const body: React.ReactNode[] = [];
  for (const { day, ms, rows: shown } of days) {
    const dayRows = shown.map((row) => modelRows.get(row.record.id)!);
    const selectable = dayRows.filter((row) => row.getCanSelect());
    const selectedCount = selectable.filter((row) => row.getIsSelected()).length;
    if (body.length > 0) {
      body.push(
        <tr key={`gap-${day}`} data-slot="day-gap">
          <td colSpan={3} className="h-6 p-0" />
        </tr>,
      );
    }
    body.push(
      <TableRow
        key={`day-${day}`}
        className="group/day border-0 bg-muted/60 hover:bg-muted/60"
        data-slot="day-group"
      >
        <TableCell className="py-0.5 pl-3">
          <Checkbox
            aria-label={`Select Records on ${dayLabel(day, today)}`}
            disabled={selectable.length === 0}
            checked={
              selectable.length > 0 && selectedCount === selectable.length
                ? true
                : selectedCount > 0
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(checked) =>
              onRowSelectionChange((current) => {
                const next = { ...current };
                for (const row of selectable) {
                  if (checked === true) next[row.id] = true;
                  else delete next[row.id];
                }
                return next;
              })
            }
          />
        </TableCell>
        <TableCell colSpan={2} className="py-0.5 pr-3 text-xs">
          <div className="flex h-6 items-center gap-1">
            <span className="font-semibold">{dayLabel(day, today)}</span>
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Add Record on ${dayLabel(day, today)}`}
              data-adding={day === addingDay || undefined}
              className="h-5 px-1 text-muted-foreground opacity-0 group-focus-within/day:opacity-100 group-hover/day:opacity-100 focus-visible:opacity-100 data-adding:opacity-100"
              onClick={() => add(day)}
            >
              <AddCircleBold />
              new
            </Button>
            <span className="ml-auto text-muted-foreground tabular-nums">{hoursMinutes(ms)}</span>
          </div>
        </TableCell>
      </TableRow>,
    );
    dayRows.forEach((row, index) => {
      body.push(
        <RecordRow key={row.id} table={table} row={row} lastOfDay={index === dayRows.length - 1} />,
      );
    });
  }

  return (
    <TableContext.Provider value={context}>
      <Table
        className="table-fixed"
        containerClassName="overflow-x-visible"
        data-slot="dashboard-table"
      >
        <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border),0_2px_6px_-1px_rgb(0_0_0/0.08)] [&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            {table.getHeaderGroups().map((group) =>
              group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'h-10 text-xs font-bold',
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

type TableInstance = ReturnType<typeof useTable<typeof features, ShownRow>>;
type TableRowModel = ReturnType<TableInstance['getRowModel']>['rows'][number];

function RecordRow({
  table,
  row,
  lastOfDay,
}: {
  table: TableInstance;
  row: TableRowModel;
  lastOfDay: boolean;
}) {
  const { record } = row.original;
  return (
    <RecordMenu row={row.original}>
      <TableRow
        data-slot="record-row"
        data-running={record.stop === null || undefined}
        data-state={row.getIsSelected() ? 'selected' : undefined}
        className={cn(record.stop === null && 'bg-emerald-500/5', lastOfDay && 'border-b-0')}
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
    </RecordMenu>
  );
}

function RecordHeader() {
  const { recordHeader } = useTableContext();
  return (
    <div className="flex items-center gap-1">
      Record
      {recordHeader}
    </div>
  );
}

function TimeHeader() {
  const { timeHeader } = useTableContext();
  return (
    <div className="flex items-center justify-end gap-1">
      Time
      {timeHeader}
    </div>
  );
}

function RecordCell({ row }: { row: ShownRow }) {
  const { editing, stopEditing, rename } = useRecordActions();
  const { record, project, client, limits } = row;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <RecordName
        name={record.name}
        open={editing === record.id}
        onClose={editing === record.id ? stopEditing : undefined}
        onRename={(name) => rename(record, name)}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {project && (
          <ProjectLabel
            project={project}
            suffix={client?.name}
            className="font-medium text-foreground/80"
          />
        )}
        {isBillable(row) && <BillableMark />}
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

function TimeCell({ row }: { row: ShownRow }) {
  const { now } = useTableContext();
  const { update } = useRecordActions();
  const { record, currency, durationMs, amount } = row;
  return (
    <div data-slot="record-time" className="flex w-full flex-col items-end gap-0.5 text-right">
      <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
        <b>{hoursMinutes(durationMs)}</b>
        {amount !== null && currency !== null && (
          <span className="text-muted-foreground">{money(currency, amount)}</span>
        )}
      </span>
      <RecordSpan record={record} now={now} onChange={(fields) => update(record, fields)} />
    </div>
  );
}
