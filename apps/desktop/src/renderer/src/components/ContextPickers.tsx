import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useContextQuery, useSetContext } from '@/hooks/useContext';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';

/** Workspace and Project pickers that set the Context the next Timer lands in. */
export function ContextPickers() {
  const context = useContextQuery();
  const workspaces = useWorkspaces();
  const workspaceId = context.data?.workspaceId;
  const projects = useProjects({ workspaceId, archived: false });
  const setContext = useSetContext();
  const ready = context.data !== undefined && workspaces.data !== undefined;

  return (
    <FieldGroup className="gap-3" data-slot="context-pickers">
      <Field>
        <FieldLabel htmlFor="context-workspace">Workspace</FieldLabel>
        <NativeSelect
          id="context-workspace"
          className="w-full"
          disabled={!ready}
          value={workspaceId ?? ''}
          onChange={(event) =>
            setContext.mutate({
              workspaceId: event.target.value,
              projectId: context.data?.projectId ?? null,
            })
          }
        >
          {workspaces.data?.map((workspace) => (
            <NativeSelectOption key={workspace.id} value={workspace.id}>
              {workspace.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="context-project">Project</FieldLabel>
        <NativeSelect
          id="context-project"
          className="w-full"
          disabled={!ready || workspaceId === undefined}
          value={context.data?.projectId ?? ''}
          onChange={(event) =>
            workspaceId && setContext.mutate({ workspaceId, projectId: event.target.value || null })
          }
        >
          <NativeSelectOption value="">No Project</NativeSelectOption>
          {projects.data?.map((project) => (
            <NativeSelectOption key={project.id} value={project.id}>
              {project.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </FieldGroup>
  );
}
