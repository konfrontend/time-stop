import { Moon, Sun, SunMoon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSetThemeMode, useThemeMode } from '@/hooks/useTheme';
import type { ThemeMode } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const options: ReadonlyArray<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: 'system', label: 'System', icon: <SunMoon /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
];

/** Follows the system until overridden; the button fills and names the override like Rounding. */
export function AppearancePicker() {
  const mode = useThemeMode();
  const setMode = useSetThemeMode();
  const current = options.find((option) => option.value === mode.data) ?? options[0]!;
  const active = current.value !== 'system';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Appearance"
          aria-pressed={active}
          data-slot="appearance-picker"
          className={cn(
            'self-start text-muted-foreground',
            active && 'bg-accent text-accent-foreground dark:bg-accent/50',
          )}
        >
          {current.icon}
          {active ? current.label : 'Follows system'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={current.value}
          onValueChange={(value) => setMode.mutate(value as ThemeMode)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
