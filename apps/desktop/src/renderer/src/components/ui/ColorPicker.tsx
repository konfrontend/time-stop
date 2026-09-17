import { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  // Every color the open picker passes through, so the editor previews it.
  onChange: (color: string) => void;
  // The color the closed picker settled on.
  onCommit: (color: string) => void;
  label?: string;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

/**
 * A circular swatch of the current color, opening the platform's color picker. The swatch is the
 * visible part; the native input lies under it, which is what the picker can be hung on.
 */
export function ColorPicker({
  value,
  onChange,
  onCommit,
  label = 'Color',
  disabled,
  className,
}: ColorPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  // Read at event time, so a caller passing a fresh callback each render rebinds nothing.
  const commit = useRef(onCommit);
  useLayoutEffect(() => {
    commit.current = onCommit;
  });

  // The picker commits once it closes, which only the native change event tells.
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const onNativeChange = () => commit.current(element.value);
    element.addEventListener('change', onNativeChange);
    return () => element.removeEventListener('change', onNativeChange);
  }, []);

  return (
    <span
      data-slot="color-picker"
      className={cn(
        'relative inline-flex size-6 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15',
        disabled && 'opacity-50',
        className,
      )}
      style={{ backgroundColor: value }}
    >
      <input
        ref={input}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        disabled={disabled}
        className="size-full cursor-pointer rounded-full opacity-0 disabled:cursor-default"
      />
    </span>
  );
}
