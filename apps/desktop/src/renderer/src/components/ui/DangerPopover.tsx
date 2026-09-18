import { useState } from 'react';
import Bin1 from '~icons/streamline-ultimate-color/bin-1';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { messageOf } from '@/lib/messageOf';

export interface Danger {
  /** Resolved as the confirm opens, so the note counts the Records of that moment. */
  describe: () => Promise<string>;
  onDelete: () => Promise<void>;
  archive?: { label: 'Archive' | 'Unarchive'; note: string; run: () => Promise<void> };
}

interface DangerPopoverProps {
  danger: Danger;
  // Written beside the trash where the row has the width for it; a Tooltip says the same otherwise.
  withLabel?: boolean;
}

/** The trash that confirms Archive and Delete of an existing Record, Workspace, Client or Project. */
export function DangerPopover({ danger, withLabel }: DangerPopoverProps) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const action = danger.archive ? 'Archive or delete' : 'Delete';

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      onOpenChange={(open) => {
        setFailure(null);
        if (open) void danger.describe().then(setNote);
      }}
    >
      <PopoverTrigger asChild>
        {withLabel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Bin1 />
            {action}
          </Button>
        ) : (
          <IconButton label={action}>
            <Bin1 />
          </IconButton>
        )}
      </PopoverTrigger>
      <ConfirmPopover
        data-slot="danger-popover"
        note={note ?? '…'}
        failures={failure ? [failure] : []}
        confirm={{
          label: 'Delete',
          variant: 'destructive',
          disabled: busy || note === null,
          onConfirm: () => void run(danger.onDelete),
        }}
      >
        {danger.archive && (
          <div className="flex flex-col gap-1 border-b pb-3">
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
      </ConfirmPopover>
    </Popover>
  );
}
