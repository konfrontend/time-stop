import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContextQuery, useSetContext } from '@/hooks/useContext';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';

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
        <Select
          disabled={!ready}
          value={workspaceId ?? ''}
          onValueChange={(id) =>
            setContext.mutate({ workspaceId: id, projectId: context.data?.projectId ?? null })
          }
        >
          <SelectTrigger id="context-workspace" className="w-full">
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
      <Field>
        <FieldLabel htmlFor="context-project">Project</FieldLabel>
        <Select
          disabled={!ready || workspaceId === undefined}
          value={toSelectValue(context.data?.projectId)}
          onValueChange={(value) =>
            workspaceId &&
            setContext.mutate({ workspaceId, projectId: fromSelectValue(value) || null })
          }
        >
          <SelectTrigger id="context-project" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No Project</SelectItem>
            {projects.data?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}
