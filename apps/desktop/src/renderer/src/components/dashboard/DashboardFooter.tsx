import { useState } from 'react';
import { Check, FolderInput, Trash2 } from 'lucide-react';
import { totalsOf } from '@time-stop/domain';
import type { DashboardRow, Project, Rounding, Totals } from '@time-stop/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { hoursMinutes, money } from '@/lib/format';
import { ProjectDot } from '@/components/ProjectDot';

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
  onExport: () => void;
  onMove: (projectId: string | null) => void;
  onDelete: () => void;
}

/** Totals and Export for the view, or the selection's sum with Move and Delete. */
export function DashboardFooter({
  totals,
  count,
  now,
  rounding,
  selected,
  projects,
  busy,
  onExport,
  onMove,
  onDelete,
}: DashboardFooterProps) {
  const [moving, setMoving] = useState(false);

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
            {hoursMinutes(sum.hours * 3_600_000)}
            {sum.amounts.map((entry) => ` · ${money(entry.currency, entry.amount)}`).join('')}
          </span>
        </span>
        <Popover open={moving} onOpenChange={setMoving}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              <FolderInput />
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
                    <Check className="invisible size-4" />
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
                        <ProjectDot project={option} />
                        <span className="truncate">{option.name}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              <Trash2 />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selected.length} {selected.length === 1 ? 'Record' : 'Records'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {hoursMinutes(sum.hours * 3_600_000)} of tracked time goes with them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {count} {count === 1 ? 'Record' : 'Records'}
        </span>
        <Button variant="outline" size="sm" disabled={busy} onClick={onExport}>
          Export
        </Button>
      </div>
    </div>
  );
}
