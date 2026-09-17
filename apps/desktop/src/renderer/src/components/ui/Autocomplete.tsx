import { useEffect, useId, useRef, useState } from 'react';
import { Input, type EditableVariant } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AutocompleteProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string;
  // Rides along to the Input it wraps.
  variant?: EditableVariant;
  onValueChange: (value: string) => void;
  // Already narrowed to what matches the text.
  options: string[];
  onPick: (option: string) => void;
  // Marked and scrolled to when the list opens.
  selected?: string | undefined;
  // Highlights the first option, so Enter picks it without arrowing.
  autoHighlight?: boolean;
  label?: (option: string) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  listClassName?: string;
}

/**
 * A text input with a list of suggestions below. ↑/↓ move the highlight, Enter picks it, Escape
 * closes. An `onKeyDown` that prevents the default takes the key over.
 */
export function Autocomplete({
  value,
  onValueChange,
  options,
  onPick,
  selected,
  autoHighlight = false,
  label = (option) => option,
  align = 'start',
  className,
  listClassName,
  onFocus,
  onBlur,
  onKeyDown,
  ref,
  ...props
}: AutocompleteProps) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(autoHighlight ? 0 : -1);
  const showing = open && options.length > 0;
  const active = options[highlight];

  // Scrolls the list itself, since scrollIntoView also scrolls every scrollable ancestor. Runs on
  // opening and arrowing only: a re-render must not pull the list back while it is being scrolled.
  useEffect(() => {
    const element = list.current;
    if (!showing || !element) return;
    const index = active === undefined ? options.indexOf(selected ?? '') : highlight;
    const option = element.children[index];
    if (!(option instanceof HTMLElement)) return;
    const { offsetTop, offsetHeight } = option;
    if (active === undefined) {
      element.scrollTop = offsetTop - (element.clientHeight - offsetHeight) / 2;
    } else if (offsetTop < element.scrollTop) {
      element.scrollTop = offsetTop;
    } else if (offsetTop + offsetHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = offsetTop + offsetHeight - element.clientHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, highlight]);

  function reset() {
    setHighlight(autoHighlight ? 0 : -1);
  }

  function pick(option: string) {
    setOpen(false);
    reset();
    onPick(option);
  }

  return (
    <Popover open={showing} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          // The caller's ref rides along: the list and the highlight need the input too.
          ref={(node) => {
            input.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="combobox"
          aria-expanded={showing}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active === undefined ? undefined : `${listId}-${highlight}`}
          autoComplete="off"
          value={value}
          className={className}
          onFocus={(event) => {
            setOpen(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setOpen(false);
            reset();
            onBlur?.(event);
          }}
          onChange={(event) => {
            setOpen(true);
            reset();
            onValueChange(event.target.value);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.key === 'Escape' || event.key === 'Enter') {
              if (
                event.key === 'Enter' &&
                showing &&
                active !== undefined &&
                !event.defaultPrevented
              ) {
                event.preventDefault();
                pick(active);
                return;
              }
              setOpen(false);
              reset();
              return;
            }
            if (event.defaultPrevented || !showing) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((index) => (index + 1) % options.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((index) => (index <= 0 ? options.length : index) - 1);
            }
          }}
          {...props}
        />
      </PopoverAnchor>
      <PopoverContent
        ref={list}
        id={listId}
        role="listbox"
        align={align}
        className={cn(
          'relative max-h-56 w-(--radix-popover-trigger-width) overflow-y-auto p-1',
          listClassName,
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && input.current?.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        {options.map((option, index) => {
          const marked = active === undefined ? option === selected : index === highlight;
          return (
            <button
              key={option}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={marked}
              className={cn(
                'block w-full truncate rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent/60',
                marked && 'bg-accent text-accent-foreground hover:bg-accent',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
            >
              {label(option)}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
