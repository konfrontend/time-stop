import { useEffect, useRef, useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import { isBillable } from '@time-stop/domain';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { BillableMark } from '@/components/BillableMark';
import { ProjectLabel } from '@/components/ProjectLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineInput } from '@/components/ui/InlineInput';
import { editorPopoverProps, ItemList, ItemRow } from '@/components/ui/ItemList';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClients } from '@/hooks/useClients';
import { useContextQuery } from '@/hooks/useContext';
import { useProjects } from '@/hooks/useProjects';
import { useUpdateWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { cn } from '@/lib/utils';
import { ClientForm } from './ClientForm';
import { ImportPopover } from './ImportPopover';
import { ProjectForm } from './ProjectForm';
import { WorkspaceForm } from './WorkspaceForm';

interface WorkspacesTabProps {
  // The Workspace whose group scrolls into view once everything has loaded.
  focus?: string | undefined;
}

/** One section per Workspace, each with its own Preferences, Clients and Projects tabs. */
export function WorkspacesTab({ focus }: WorkspacesTabProps) {
  const workspaces = useWorkspaces();
  const clients = useClients(null);
  const projects = useProjects({});
  const context = useContextQuery();
  const container = useRef<HTMLDivElement>(null);
  const loaded = workspaces.isSuccess && clients.isSuccess && projects.isSuccess;

  useEffect(() => {
    if (!loaded || !focus) return;
    const groups = container.current?.querySelectorAll<HTMLElement>('[data-workspace-id]') ?? [];
    [...groups]
      .find((group) => group.dataset.workspaceId === focus)
      ?.scrollIntoView({ block: 'start' });
  }, [loaded, focus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="workspaces-tab">
      <div ref={container} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-3">
        <NewWorkspace />
        {workspaces.data?.map((workspace, index) => (
          <WorkspaceGroup
            key={workspace.id}
            workspace={workspace}
            isDefault={index === 0}
            workspaces={workspaces.data}
            clients={clients.data?.filter((c) => c.workspaceId === workspace.id) ?? []}
            projects={projects.data?.filter((p) => p.workspaceId === workspace.id) ?? []}
          />
        ))}
      </div>
      {workspaces.data && workspaces.data.length > 0 && context.data && (
        <div
          className="flex shrink-0 items-center justify-end border-t bg-muted/40 px-3 py-2"
          data-slot="workspaces-footer"
        >
          <ImportPopover
            workspaces={workspaces.data}
            defaultWorkspaceId={context.data.workspaceId}
          />
        </div>
      )}
    </div>
  );
}

function NewWorkspace() {
  const [open, setOpen] = useState(false);
  return (
    <div className="-mb-4 flex h-8 items-center px-1">
      <SectionTitle>Workspaces</SectionTitle>
      <span className="ml-auto" />
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost-icon" size="icon-sm" aria-label="New Workspace">
                <AddCircleBold />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>New Workspace</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" {...editorPopoverProps}>
          <WorkspaceForm onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface GroupProps {
  workspace: Workspace;
  workspaces: Workspace[];
  clients: Client[];
  projects: Project[];
}

function WorkspaceGroup({ isDefault, ...props }: GroupProps & { isDefault: boolean }) {
  const { workspace } = props;
  const update = useUpdateWorkspace();
  return (
    <Card
      role="region"
      aria-label={workspace.name}
      data-slot="workspace-group"
      data-workspace-id={workspace.id}
      className="scroll-mt-3 gap-3 p-3"
    >
      <div className="flex min-h-8 items-center gap-2 px-1 text-sm">
        <InlineInput
          value={workspace.name}
          // An empty Name is no Name: the heading keeps the one it had.
          onCommit={(name) =>
            name && update.mutate({ id: workspace.id, name, currency: workspace.currency })
          }
          label="Workspace Name"
          slot="workspace-name"
          className="min-w-0 flex-1 font-medium"
        />
        {workspace.currency && (
          <span className="text-xs text-muted-foreground">{workspace.currency}</span>
        )}
      </div>
      <Tabs defaultValue="preferences" className="gap-3">
        <TabsList>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="preferences" className="px-1">
          <WorkspaceForm
            initial={workspace}
            isDefault={isDefault}
            showName={false}
            onClose={() => {}}
          />
        </TabsContent>
        <TabsContent value="clients">
          <ClientList {...props} />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectList {...props} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ClientList({ workspace, clients, projects }: GroupProps) {
  const count = (client: Client) => projects.filter((p) => p.clientId === client.id).length;
  const newForm = (close: () => void) => <ClientForm workspaceId={workspace.id} onClose={close} />;
  return (
    <ItemList
      title="Clients"
      newLabel="New Client"
      newForm={newForm}
      empty={
        clients.length === 0
          ? { title: `${workspace.name} has no Clients.`, cta: 'Create New Client' }
          : undefined
      }
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

function ProjectList({ workspace, workspaces, clients, projects }: GroupProps) {
  // Session-only: Archived Projects show dimmed after the active ones while the toggle is on.
  const [showArchived, setShowArchived] = useState(false);
  const archived = projects.filter((p) => p.archived).length;
  const shown = projects
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => Number(a.archived) - Number(b.archived));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name;
  const form = (close: () => void, initial?: Project) => (
    <ProjectForm
      workspace={workspace}
      workspaces={workspaces}
      clients={clients}
      initial={initial}
      onClose={close}
    />
  );

  return (
    <ItemList
      title="Projects"
      newLabel="New Project"
      newForm={(close) => form(close)}
      empty={
        projects.length === 0
          ? { title: `${workspace.name} has no Projects.`, cta: 'Create New Project' }
          : undefined
      }
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
        const billable = isBillable({ project, currency: workspace.currency });
        return (
          <ItemRow
            key={project.id}
            className={cn(project.archived && 'opacity-60')}
            form={(close) => form(close, project)}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <ProjectLabel project={project} suffix={project.archived ? 'Archived' : null} />
                {billable && <BillableMark className="size-5" />}
              </span>
              {(client || project.rate !== null) && (
                <span className="flex min-w-0 gap-3 pl-3.5 text-xs text-muted-foreground">
                  {client && <span className="truncate">{client}</span>}
                  {project.rate !== null && (
                    <>
                      <span className={cn('shrink-0 tabular-nums', !billable && 'opacity-60')}>
                        {project.rate}/h
                      </span>
                      {workspace.currency === null && (
                        <span className="truncate">Set a Currency on {workspace.name} to bill</span>
                      )}
                    </>
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
