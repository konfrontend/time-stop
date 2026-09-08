import { useState } from 'react';
import type { Rounding } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExportReport } from '@/hooks/useDashboard';
import { toExportInput } from '@/lib/dashboardSearch';
import type { DashboardSelection } from '@/lib/dashboardSearch';
import { Segmented } from './Segmented';

interface ExportDialogProps {
  selection: DashboardSelection;
  onRounding: (rounding: Rounding) => void;
  onClose: () => void;
}

const roundingOptions: ReadonlyArray<{ value: Rounding; label: string }> = [
  { value: 'none', label: 'None' },
  { value: '15m', label: 'Nearest 15 min' },
];

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The Rounding choice; the save dialog follows, on the current view. */
export function ExportDialog({ selection, onRounding, onClose }: ExportDialogProps) {
  const exportReport = useExportReport();
  const [failure, setFailure] = useState<string | null>(null);

  async function save() {
    setFailure(null);
    try {
      await exportReport.mutateAsync(toExportInput(selection));
      onClose();
    } catch (error) {
      setFailure(messageOf(error));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-slot="export-dialog">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            A CSV of the current view; the running Timer stays out.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Rounding</span>
          <Segmented
            label="Rounding"
            value={selection.rounding}
            options={roundingOptions}
            onChange={onRounding}
          />
        </div>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={exportReport.isPending} onClick={() => void save()}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
