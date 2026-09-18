import { Button } from '@/components/ui/button';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import { DangerPopover } from '@/components/ui/DangerPopover';
import type { Danger } from '@/components/ui/DangerPopover';
import { Popover, PopoverAnchor } from '@/components/ui/popover';

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
    <div data-slot="form-footer" className="flex items-center gap-2">
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
