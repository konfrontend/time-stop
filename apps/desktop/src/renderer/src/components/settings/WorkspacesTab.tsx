import { useState } from 'react';
import DiamondShine from '~icons/streamline-ultimate-color/diamond-shine';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
import { Button } from '@/components/ui/button';
import { ItemList, ItemRow } from '@/components/ui/ItemList';
import { useClients } from '@/hooks/useClients';
import { useContextQuery } from '@/hooks/useContext';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { cn } from '@/lib/utils';
import { ClientForm } from './ClientForm';
import { ImportPopover } from './ImportPopover';
import { ProjectForm } from './ProjectForm';
import { WorkspaceForm } from './WorkspaceForm';

/** Every Workspace, then the Clients and Projects of the Context's Workspace. */
export function WorkspacesTab() {
  const context = useContextQuery();
  const workspaces = useWorkspaces();
  const workspaceId = context.data?.workspaceId ?? null;
  const clients = useClients(workspaceId);
  const projects = useProjects({ workspaceId: workspaceId ?? undefined });
  const workspace = workspaces.data?.find((w) => w.id === workspaceId);

  return (
    <div className="flex flex-col gap-6 px-4 py-3" data-slot="workspaces-tab">
      <ItemList
        title="Workspaces"
        newLabel="New Workspace"
        newForm={(close) => <WorkspaceForm onClose={close} />}
        slot="workspaces-list"
      >
        {workspaces.data?.map((w, index) => (
          <WorkspaceRow key={w.id} workspace={w} isDefault={index === 0} />
        ))}
      </ItemList>
      {workspace && (
        <ClientList
          workspace={workspace}
          clients={clients.data ?? []}
          projects={projects.data ?? []}
        />
      )}
      {workspace && (
        <ProjectList
          workspace={workspace}
          workspaces={workspaces.data ?? []}
          clients={clients.data ?? []}
          projects={projects.data ?? []}
        />
      )}
    </div>
  );
}

function WorkspaceRow({ workspace, isDefault }: { workspace: Workspace; isDefault: boolean }) {
  return (
    <ItemRow
      aside={<ImportPopover workspace={workspace} />}
      form={(close) => <WorkspaceForm initial={workspace} isDefault={isDefault} onClose={close} />}
    >
      <span className="flex-1 truncate">{workspace.name}</span>
      {workspace.currency && (
        <span className="text-xs text-muted-foreground">{workspace.currency}</span>
      )}
    </ItemRow>
  );
}

interface ListProps {
  workspace: Workspace;
  clients: Client[];
  projects: Project[];
}

function ClientList({ workspace, clients, projects }: ListProps) {
  const count = (client: Client) => projects.filter((p) => p.clientId === client.id).length;
  return (
    <ItemList
      title={`Clients of ${workspace.name}`}
      newLabel="New Client"
      newForm={(close) => <ClientForm workspaceId={workspace.id} onClose={close} />}
      empty={clients.length === 0 ? `No Clients in ${workspace.name} yet.` : undefined}
      slot="clients-list"
    >
      {clients.map((client) => (
        <ItemRow
          key={client.id}
          form={(close) => (
            <ClientForm workspaceId={workspace.id} initial={client} onClose={close} />
          )}
        >
          <span className="flex-1 truncate">{client.name}</span>
          <span className="text-xs text-muted-foreground">
            {count(client) === 1 ? '1 Project' : `${count(client)} Projects`}
          </span>
        </ItemRow>
      ))}
    </ItemList>
  );
}

function ProjectList({
  workspace,
  workspaces,
  clients,
  projects,
}: ListProps & { workspaces: Workspace[] }) {
  // Session-only: Archived Projects show dimmed after the active ones while the toggle is on.
  const [showArchived, setShowArchived] = useState(false);
  const archived = projects.filter((p) => p.archived).length;
  const shown = projects
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => Number(a.archived) - Number(b.archived));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name;

  return (
    <ItemList
      title={`Projects of ${workspace.name}`}
      newLabel="New Project"
      newForm={(close) => (
        <ProjectForm
          workspace={workspace}
          workspaces={workspaces}
          clients={clients}
          onClose={close}
        />
      )}
      empty={shown.length === 0 ? `No Projects in ${workspace.name} yet.` : undefined}
      slot="projects-list"
      aside={
        archived > 0 && (
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={showArchived}
            className={cn(
              'text-muted-foreground',
              showArchived && 'bg-accent text-accent-foreground dark:bg-accent/50',
            )}
            onClick={() => setShowArchived((v) => !v)}
          >
            Archived {archived}
          </Button>
        )
      }
    >
      {shown.map((project) => {
        const client = clientName(project.clientId);
        return (
          <ItemRow
            key={project.id}
            className={cn(project.archived && 'opacity-60')}
            form={(close) => (
              <ProjectForm
                workspace={workspace}
                workspaces={workspaces}
                clients={clients}
                initial={project}
                onClose={close}
              />
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <ProjectLabel project={project} suffix={project.archived ? 'Archived' : null} />
                {project.rate !== null && (
                  <DiamondShine
                    className="size-3 shrink-0"
                    aria-label="Billable"
                    role="img"
                  />
                )}
              </span>
              {(client || project.rate !== null) && (
                <span className="flex min-w-0 gap-3 pl-3.5 text-xs text-muted-foreground">
                  {client && <span className="truncate">{client}</span>}
                  {project.rate !== null && (
                    <span className="shrink-0 tabular-nums">{project.rate}/h</span>
                  )}
                </span>
              )}
            </span>
          </ItemRow>
        );
      })}
    </ItemList>
  );
}
