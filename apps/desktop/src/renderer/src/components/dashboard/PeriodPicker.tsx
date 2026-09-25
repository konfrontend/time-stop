import { useState } from 'react';
import ArrowButtonUp from '~icons/streamline-ultimate-color/arrow-button-up';
import type { DayProps } from 'react-day-picker';
import { formatIsoDate, periodBounds } from '@app/domain';
import type { Period } from '@app/domain';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { Calendar } from '@/components/ui/calendar';

interface PeriodPickerProps {
  period: Period;
  // The shown Range's bounds; `to` is exclusive.
  from: string;
  to: string;
  // Called with the first day of the picked Period, `YYYY-MM-DD`.
  onAnchor: (anchor: string) => void;
}

/** Picks a whole Period: a week from a day grid, or a month from a year of months. */
export function PeriodPicker({ period, ...props }: PeriodPickerProps) {
  return period === 'week' ? <WeekGrid {...props} /> : <MonthGrid {...props} />;
}

const firstDayOf = (period: Period, timestamp: string) =>
  formatIsoDate(periodBounds(period, timestamp).from);

// The picked week reads as selected; the grid has no selection mode of its own.
function PickedDay({ day: _day, modifiers, ...props }: DayProps) {
  return <td {...props} aria-selected={modifiers.picked || undefined} />;
}

function WeekGrid({ from, to, onAnchor }: Omit<PeriodPickerProps, 'period'>) {
  const start = new Date(from);
  const end = new Date(Date.parse(to) - 1);
  return (
    <Calendar
      weekStartsOn={1}
      defaultMonth={start}
      modifiers={{ picked: { from: start, to: end } }}
      modifiersClassNames={{ picked: 'bg-accent first:rounded-l-md last:rounded-r-md' }}
      components={{ Day: PickedDay }}
      onDayClick={(day) => onAnchor(firstDayOf('week', day.toISOString()))}
    />
  );
}

const months = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' }),
);

function MonthGrid({ from, onAnchor }: Omit<PeriodPickerProps, 'period'>) {
  const picked = new Date(from);
  const [year, setYear] = useState(picked.getFullYear());
  return (
    <div className="flex w-56 flex-col gap-2 p-2" data-slot="month-grid">
      <div className="flex items-center">
        <IconButton label="Previous year" onClick={() => setYear(year - 1)}>
          <ArrowButtonUp className="-rotate-90" />
        </IconButton>
        <span className="flex-1 text-center text-sm font-medium">{year}</span>
        <IconButton label="Next year" onClick={() => setYear(year + 1)}>
          <ArrowButtonUp className="rotate-90" />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((label, month) => {
          const current = year === picked.getFullYear() && month === picked.getMonth();
          return (
            <Button
              key={month}
              variant={current ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={current}
              onClick={() => onAnchor(firstDayOf('month', new Date(year, month, 1).toISOString()))}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
