import { useState } from 'react';
import { ClientsSection } from '@/components/settings/ClientsSection';
import { ImportSection } from '@/components/settings/ImportSection';
import { ProjectsSection } from '@/components/settings/ProjectsSection';
import { ServerSection } from '@/components/settings/ServerSection';
import { WorkspacesSection } from '@/components/settings/WorkspacesSection';
import { Field, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useContextQuery } from '@/hooks/useContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export function Settings() {
  const workspaces = useWorkspaces();
  const context = useContextQuery();
  const [picked, setPicked] = useState<string | null>(null);
  // Starts on the Context's Workspace; falls back once the picked one is deleted.
  const selected =
    workspaces.data?.find((w) => w.id === (picked ?? context.data?.workspaceId))?.id ??
    workspaces.data?.[0]?.id;

  return (
    <div className="flex flex-col gap-4" data-slot="settings">
      <h1 className="text-lg font-semibold">Settings</h1>
      {workspaces.data && <WorkspacesSection workspaces={workspaces.data} />}
      <Field>
        <FieldLabel htmlFor="settings-workspace">Clients and Projects of</FieldLabel>
        <NativeSelect
          id="settings-workspace"
          className="w-full"
          value={selected ?? ''}
          disabled={selected === undefined}
          onChange={(event) => setPicked(event.target.value)}
        >
          {workspaces.data?.map((workspace) => (
            <NativeSelectOption key={workspace.id} value={workspace.id}>
              {workspace.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {selected && <ClientsSection workspaceId={selected} />}
      {selected && <ProjectsSection workspaceId={selected} />}
      {workspaces.data && selected && (
        <ImportSection workspaces={workspaces.data} workspaceId={selected} />
      )}
      <ServerSection />
    </div>
  );
}
