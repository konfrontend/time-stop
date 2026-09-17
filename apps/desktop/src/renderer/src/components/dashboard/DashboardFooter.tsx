import { useState } from 'react';
import Bin1 from '~icons/streamline-ultimate-color/bin-1';
import Check from '~icons/streamline-ultimate-color/check';
import FolderUpload from '~icons/streamline-ultimate-color/folder-upload';
import { totalsOf } from '@time-stop/domain';
import type { DashboardRow, Project, Rounding, Totals } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { hoursMinutes, money } from '@/lib/format';

const hours = (h: number) => `${h.toFixed(2)} h`;

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <b className="text-[15px] tabular-nums">{value}</b>
    </div>
  );
}

interface DashboardFooterProps {
  totals: Totals;
  count: number;
  now: number;
  rounding: Rounding;
  // Rows ticked in the table; with any, the footer turns to their actions.
  selected: DashboardRow[];
  projects: Project[];
  busy: boolean;
  onMove: (projectId: string | null) => void;
  onDelete: () => void;
}

/** Totals for the view, or the selection's sum with Move and Delete. */
export function DashboardFooter({
  totals,
  count,
  now,
  rounding,
  selected,
  projects,
  busy,
  onMove,
  onDelete,
}: DashboardFooterProps) {
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (selected.length > 0) {
    const sum = totalsOf(selected, now, rounding);
    return (
      <div
        className="flex items-center gap-3 border-t bg-muted/40 px-3 py-2 text-sm"
        data-slot="totals-bar"
        data-selection
      >
        <span className="flex min-w-0 flex-1 flex-col tabular-nums">
          <b>{selected.length} selected</b>
          <span className="truncate text-xs text-muted-foreground">
            <span className="flex gap-3">
              <span>{hoursMinutes(sum.hours * 3_600_000)}</span>
              {sum.amounts.map((entry) => (
                <span key={entry.currency}>{money(entry.currency, entry.amount)}</span>
              ))}
            </span>
          </span>
        </span>
        <Popover open={moving} onOpenChange={setMoving}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              <FolderUpload />
              Move to…
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Find a Project…" />
              <CommandList>
                <CommandEmpty>No Project matches.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    className="text-muted-foreground"
                    onSelect={() => {
                      setMoving(false);
                      onMove(null);
                    }}
                  >
                    <Check className="invisible size-5" />
                    No Project
                  </CommandItem>
                  {projects
                    .filter((p) => !p.archived)
                    .map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.name}
                        onSelect={() => {
                          setMoving(false);
                          onMove(option.id);
                        }}
                      >
                        <ProjectLabel project={option} />
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover open={deleting} onOpenChange={setDeleting}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              <Bin1 />
              Delete
            </Button>
          </PopoverTrigger>
          <ConfirmPopover
            data-slot="delete-confirm"
            note={
              <>
                Delete {selected.length} {selected.length === 1 ? 'Record' : 'Records'}?
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {hoursMinutes(sum.hours * 3_600_000)} of tracked time goes with them.
                </span>
              </>
            }
            onCancel={() => setDeleting(false)}
            confirm={{
              label: 'Delete',
              variant: 'destructive',
              onConfirm: () => {
                setDeleting(false);
                onDelete();
              },
            }}
          />
        </Popover>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/40 px-3 py-2.5"
      data-slot="totals-bar"
    >
      <Cell label="Total" value={hours(totals.hours)} />
      <Cell label="Billable" value={hours(totals.billableHours)} />
      {totals.amounts.length === 0 ? (
        <Cell label="Amount" value="—" />
      ) : (
        totals.amounts.map((entry) => (
          <Cell key={entry.currency} label="Amount" value={money(entry.currency, entry.amount)} />
        ))
      )}
      <span className="ml-auto text-xs text-muted-foreground">
        {count} {count === 1 ? 'Record' : 'Records'}
      </span>
    </div>
  );
}
