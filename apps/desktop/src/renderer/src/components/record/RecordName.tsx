import { InlineInput } from '@/components/ui/InlineInput';
import { UNTITLED_RECORD } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RecordNameProps {
  name: string;
  onRename: (name: string) => void;
  // Opens the input without a click, for a Record that was just added; cleared through `onClose`.
  open?: boolean;
  onClose?: (() => void) | undefined;
  className?: string;
}

/** A Record's Name, edited in place. */
export function RecordName({ name, onRename, open = false, onClose, className }: RecordNameProps) {
  return (
    <InlineInput
      value={name}
      onCommit={onRename}
      label="Name"
      placeholder={UNTITLED_RECORD}
      slot="record-name"
      open={open}
      onClose={onClose}
      className={cn('h-5 text-sm', className)}
    />
  );
}
