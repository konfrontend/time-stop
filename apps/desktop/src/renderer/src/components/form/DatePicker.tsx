import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  id?: string;
  // `YYYY-MM-DD`, or empty for none.
  value: string;
  onChange: (value: string) => void;
  'aria-invalid'?: boolean | undefined;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value: string): Date | undefined {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A calendar day as a button that opens a month grid; the value is a local `YYYY-MM-DD`. */
export function DatePicker({ id, value, onChange, className, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-slot="date-picker"
          className={cn(
            'w-full justify-start font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
          {...rest}
        >
          <CalendarIcon className="text-muted-foreground" />
          {date
            ? date.toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Pick a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          {...(date ? { selected: date, defaultMonth: date } : {})}
          onSelect={(picked) => {
            if (!picked) return;
            onChange(toIsoDate(picked));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
