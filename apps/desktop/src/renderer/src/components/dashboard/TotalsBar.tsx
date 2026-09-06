import type { Totals } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/format';

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

export function TotalsBar({ totals, count }: { totals: Totals; count: number }) {
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
        <Button variant="outline" size="sm" disabled title="Export arrives with Reports">
          Export…
        </Button>
      </div>
    </div>
  );
}
