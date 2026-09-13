import { useState } from 'react';
import { ClientsSection } from '@/components/settings/ClientsSection';
import { ImportSection } from '@/components/settings/ImportSection';
import { ProjectsSection } from '@/components/settings/ProjectsSection';
import { ServerSection } from '@/components/settings/ServerSection';
import { WorkspacesSection } from '@/components/settings/WorkspacesSection';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContextQuery } from '@/hooks/useContext';
import { useVersion } from '@/hooks/useRelease';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export function Settings() {
  const workspaces = useWorkspaces();
  const context = useContextQuery();
  const version = useVersion();
  const [picked, setPicked] = useState<string | null>(null);
  // Starts on the Context's Workspace; falls back once the picked one is deleted.
  const selected =
    workspaces.data?.find((w) => w.id === (picked ?? context.data?.workspaceId))?.id ??
    workspaces.data?.[0]?.id;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4" data-slot="settings">
      <h1 className="text-lg font-semibold">Settings</h1>
      {workspaces.data && <WorkspacesSection workspaces={workspaces.data} />}
      <Field>
        <FieldLabel htmlFor="settings-workspace">Clients and Projects of</FieldLabel>
        <Select value={selected ?? ''} disabled={selected === undefined} onValueChange={setPicked}>
          <SelectTrigger id="settings-workspace" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspaces.data?.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {selected && <ClientsSection workspaceId={selected} />}
      {selected && <ProjectsSection workspaceId={selected} />}
      {workspaces.data && selected && (
        <ImportSection workspaces={workspaces.data} workspaceId={selected} />
      )}
      <ServerSection />
      {version.data && (
        <p className="text-xs text-muted-foreground" data-slot="app-version">
          Time Stop {version.data}
        </p>
      )}
    </div>
  );
}
