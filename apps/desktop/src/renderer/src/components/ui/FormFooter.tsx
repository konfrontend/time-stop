import { useState } from 'react';
import Bin1 from '~icons/streamline-ultimate-color/bin-1';
import { Button } from '@/components/ui/button';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { messageOf } from '@/lib/messageOf';

export interface Danger {
  /** Resolved as the confirm opens, so the note counts the Records of that moment. */
  describe: () => Promise<string>;
  onDelete: () => Promise<void>;
  archive?: { label: 'Archive' | 'Unarchive'; note: string; run: () => Promise<void> };
  // Why the trash is disabled, as a Tooltip.
  disabledReason?: string | undefined;
}

/** Shown over Save: a warning to confirm first, or what the last submit left wrong. */
export interface SaveAlert {
  note?: string | undefined;
  // Present with a note that asks; saves past the warning.
  onConfirm?: (() => void) | undefined;
  failures?: string[] | undefined;
}

interface FormFooterProps {
  submitting: boolean;
  onCancel: () => void;
  alert?: SaveAlert | null | undefined;
  onAlertClose?: (() => void) | undefined;
  // Absent on a form that creates: nothing to archive or delete yet.
  danger?: Danger | undefined;
}

/** Save and Cancel, and for an existing Item the trash that confirms Archive and Delete. */
export function FormFooter({ submitting, onCancel, alert, onAlertClose, danger }: FormFooterProps) {
  return (
    <div className="flex items-center gap-2">
      <Popover open={!!alert} onOpenChange={(open) => !open && onAlertClose?.()}>
        <PopoverAnchor asChild>
          <Button type="submit" size="sm" disabled={submitting}>
            Save
          </Button>
        </PopoverAnchor>
        {alert && (
          <ConfirmPopover
            align="start"
            data-slot="save-alert"
            note={alert.note}
            failures={alert.failures}
            confirm={alert.onConfirm && { label: 'Save anyway', onConfirm: alert.onConfirm }}
            onCancel={alert.onConfirm && onAlertClose}
          />
        )}
      </Popover>
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
  const [failure, setFailure] = useState<string | null>(null);
  const disabled = danger.disabledReason !== undefined;

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
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost-icon"
              size="icon-sm"
              aria-label={danger.archive ? 'Archive or delete' : 'Delete'}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
            >
              <Bin1 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {disabled && <TooltipContent>{danger.disabledReason}</TooltipContent>}
      </Tooltip>
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
