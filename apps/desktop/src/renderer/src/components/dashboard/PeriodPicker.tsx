import { useState } from 'react';
import NavigationLeft from '~icons/streamline-ultimate-color/navigation-left';
import { formatIsoDate, parseIsoDate, periodBounds } from '@time-stop/domain';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { Calendar } from '@/components/ui/calendar';

interface PeriodPickerProps {
  period: Period;
  // First day of the shown Range, `YYYY-MM-DD`.
  anchor: string;
  onAnchor: (anchor: string) => void;
}

/** Picks a whole Period: a week from a day grid, or a month from a year of months. */
export function PeriodPicker({ period, anchor, onAnchor }: PeriodPickerProps) {
  return period === 'week' ? (
    <WeekGrid anchor={anchor} onAnchor={onAnchor} />
  ) : (
    <MonthGrid anchor={anchor} onAnchor={onAnchor} />
  );
}

const firstDayOf = (period: Period, timestamp: string) =>
  formatIsoDate(periodBounds(period, timestamp).from);

function WeekGrid({ anchor, onAnchor }: Omit<PeriodPickerProps, 'period'>) {
  const start = new Date(parseIsoDate(anchor));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return (
    <Calendar
      weekStartsOn={1}
      defaultMonth={start}
      modifiers={{ picked: { from: start, to: end } }}
      modifiersClassNames={{ picked: 'bg-accent first:rounded-l-md last:rounded-r-md' }}
      onDayClick={(day) => onAnchor(firstDayOf('week', day.toISOString()))}
    />
  );
}

const months = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' }),
);

function MonthGrid({ anchor, onAnchor }: Omit<PeriodPickerProps, 'period'>) {
  const picked = new Date(parseIsoDate(anchor));
  const [year, setYear] = useState(picked.getFullYear());
  return (
    <div className="flex w-56 flex-col gap-2 p-2" data-slot="month-grid">
      <div className="flex items-center">
        <IconButton label="Previous year" onClick={() => setYear(year - 1)}>
          <NavigationLeft />
        </IconButton>
        <span className="flex-1 text-center text-sm font-medium">{year}</span>
        <IconButton label="Next year" onClick={() => setYear(year + 1)}>
          <NavigationLeft className="-scale-x-100" />
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
