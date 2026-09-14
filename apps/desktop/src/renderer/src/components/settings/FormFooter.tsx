import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface Danger {
  /** Resolved as the confirm opens, so the note counts the Records of that moment. */
  describe: () => Promise<string>;
  onDelete: () => Promise<void>;
  archive?: { label: 'Archive' | 'Unarchive'; note: string; run: () => Promise<void> };
  // Why the trash is disabled, as a Tooltip.
  disabledReason?: string | undefined;
}

interface FormFooterProps {
  submitting: boolean;
  onCancel: () => void;
  // Absent on a form that creates: nothing to archive or delete yet.
  danger?: Danger | undefined;
}

/** Save and Cancel, and for an existing Item the trash that confirms Archive and Delete. */
export function FormFooter({ submitting, onCancel, danger }: FormFooterProps) {
  return (
    <div className="flex items-center gap-2">
      <Button type="submit" size="sm" disabled={submitting}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <span className="ml-auto" />
      {danger && <DangerPopover danger={danger} />}
    </div>
  );
}

function DangerPopover({ danger }: { danger: Danger }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = danger.disabledReason !== undefined;

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover onOpenChange={(open) => open && void danger.describe().then(setNote)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Archive or delete"
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {disabled && <TooltipContent>{danger.disabledReason}</TooltipContent>}
      </Tooltip>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex w-64 flex-col gap-3 text-sm"
        data-slot="danger-popover"
      >
        {danger.archive && (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground">{danger.archive.note}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => void run(danger.archive!.run)}
            >
              {danger.archive.label}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground">{note ?? '…'}</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="self-start"
            disabled={busy || note === null}
            onClick={() => void run(danger.onDelete)}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
