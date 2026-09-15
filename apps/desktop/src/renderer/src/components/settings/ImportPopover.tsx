import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import MonitorTransfer1 from '~icons/streamline-ultimate-color/monitor-transfer-1';
import type { Workspace } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { messageOf } from '@/lib/messageOf';

type ImportTogglResult = NonNullable<
  Awaited<ReturnType<Window['desktop']['imports']['importToggl']>>
>;

/** The zone of this machine, which a Toggl export written elsewhere needs corrected. */
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** UTC and the zone of this machine lead; neither is guaranteed to be in the platform's list. */
function zones(): string[] {
  const supported = Intl.supportedValuesOf?.('timeZone') ?? [];
  return [...new Set([localZone, 'UTC', ...supported])];
}

function summarize(result: ImportTogglResult): string {
  const parts = [
    `${result.records} Records`,
    `${result.projects} Projects`,
    `${result.clients} Clients`,
  ];
  const skipped = result.skipped > 0 ? ` ${result.skipped} entries were already here.` : '';
  return `Imported ${parts.join(', ')} from ${result.filename}.${skipped}`;
}

/** On a Workspace row: reads a Toggl Track CSV export into that Workspace; the file dialog opens on Import. */
export function ImportPopover({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const zoneField = useId();
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState(localZone);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(): Promise<void> {
    setOutcome(null);
    setFailure(null);
    setRunning(true);
    try {
      const result = await window.desktop.imports.importToggl({ workspaceId: workspace.id, zone });
      if (result) {
        setOutcome(summarize(result));
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      setFailure(messageOf(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost-icon"
              size="icon-sm"
              aria-label={`Import into ${workspace.name}`}
              className="text-muted-foreground"
            >
              <MonitorTransfer1 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Import from Toggl Track</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex w-72 flex-col gap-3"
        data-slot="import-popover"
        overlay
      >
        <p className="text-sm font-medium">Import into {workspace.name}</p>
        <p className="text-xs text-muted-foreground">
          Export a detailed report as CSV from Toggl Track, then import it here. Running the same
          export twice adds nothing.
        </p>
        <Field>
          <FieldLabel htmlFor={zoneField}>Time zone of the export</FieldLabel>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger id={zoneField} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones().map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button size="sm" disabled={running} onClick={() => void run()}>
            {running ? 'Importing…' : 'Choose CSV and import'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
        {outcome && <p className="text-sm">{outcome}</p>}
        {failure && <p className="text-sm text-destructive">{failure}</p>}
      </PopoverContent>
    </Popover>
  );
}
