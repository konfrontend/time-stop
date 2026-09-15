import { Gem } from 'lucide-react';
import { isBillable } from '@time-stop/domain';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { useSetContext } from '@/hooks/useContext';

interface ProjectPickerProps {
  workspace: Workspace;
  projects: Project[];
  project: Project | null;
  client: Client | null;
}

/** Picks the Context's Project; beside it the Client and, when the Project earns money, a gem. */
export function ProjectPicker({ workspace, projects, project, client }: ProjectPickerProps) {
  const setContext = useSetContext();
  const billable = isBillable({ project, currency: workspace.currency });

  return (
    <div className="flex max-w-full items-center gap-2" data-slot="project-picker">
      <ProjectCombobox
        workspaceId={workspace.id}
        projects={projects}
        value={project?.id ?? null}
        onChange={(projectId) => setContext.mutate({ workspaceId: workspace.id, projectId })}
      />
      {client && <span className="truncate text-sm text-muted-foreground">{client.name}</span>}
      {billable && (
        <Gem
          className="size-3.5 shrink-0 text-muted-foreground"
          role="img"
          aria-label="Billable"
          data-slot="billable"
        >
          <title>Billable</title>
        </Gem>
      )}
    </div>
  );
}
