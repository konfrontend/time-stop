import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Workspace } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type ImportTogglResult = NonNullable<Awaited<ReturnType<Window['imports']['importToggl']>>>;

/** The zone of this machine, which a Toggl export written elsewhere needs corrected. */
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** UTC and the zone of this machine lead; neither is guaranteed to be in the platform's list. */
function zones(): string[] {
  const supported = Intl.supportedValuesOf?.('timeZone') ?? [];
  return [...new Set([localZone, 'UTC', ...supported])];
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function summarize(result: ImportTogglResult): string {
  const parts = [
    `${result.records} Records`,
    `${result.projects} Projects`,
    `${result.clients} Clients`,
  ];
  const skipped = result.skipped > 0 ? ` ${result.skipped} entries were already here.` : '';
  return `Imported ${parts.join(', ')} from ${result.filename}.${skipped}`;
}

interface ImportSectionProps {
  workspaces: Workspace[];
  workspaceId: string;
}

/** Reads a Toggl Track CSV export into a Workspace; the file dialog opens on Import. */
export function ImportSection({ workspaces, workspaceId }: ImportSectionProps) {
  const queryClient = useQueryClient();
  const workspaceField = useId();
  const zoneField = useId();
  const [target, setTarget] = useState(workspaceId);
  const [zone, setZone] = useState(localZone);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const chosen = workspaces.some((workspace) => workspace.id === target) ? target : workspaceId;

  async function run(): Promise<void> {
    setOutcome(null);
    setFailure(null);
    setRunning(true);
    try {
      const result = await window.imports.importToggl({ workspaceId: chosen, zone });
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
    <Card data-slot="import-section">
      <CardHeader>
        <CardTitle>Import from Toggl Track</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Export a detailed report as CSV from Toggl Track, then import it here. Running the same
          export twice adds nothing.
        </p>
        <Field>
          <FieldLabel htmlFor={workspaceField}>Into Workspace</FieldLabel>
          <NativeSelect
            id={workspaceField}
            className="w-full"
            value={chosen}
            onChange={(event) => setTarget(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <NativeSelectOption key={workspace.id} value={workspace.id}>
                {workspace.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={zoneField}>Time zone of the export</FieldLabel>
          <NativeSelect
            id={zoneField}
            className="w-full"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            {zones().map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button className="self-start" disabled={running} onClick={() => void run()}>
          {running ? 'Importing…' : 'Choose CSV and import'}
        </Button>
        {outcome && <p className="text-sm">{outcome}</p>}
        {failure && <p className="text-sm text-destructive">{failure}</p>}
      </CardContent>
    </Card>
  );
}
