import Filter1 from '~icons/streamline-ultimate-color/filter-1';
import RemoveBold from '~icons/streamline-ultimate-color/remove-bold';
import { ProjectLabel } from '@/components/ProjectLabel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import type { DashboardSelection, Filters } from '@/lib/dashboardSearch';
import { ProjectSearch } from './ProjectSearch';

interface DashboardToolbarProps {
  selection: DashboardSelection;
  onFilters: (filters: Filters) => void;
}

/** Project search, the Client chip and the picked Projects, wrapping onto more rows as needed. */
export function DashboardToolbar({ selection, onFilters }: DashboardToolbarProps) {
  const projects = useProjects({ workspaceId: selection.workspace });
  const clients = useClients(selection.workspace);
  const filters: Filters = {
    projects: selection.projects,
    client: selection.client,
    billable: selection.billable,
  };
  const picked = selection.projects
    .map((id) => projects.data?.find((p) => p.id === id))
    .filter((project) => project !== undefined);
  const client = clients.data?.find((c) => c.id === selection.client) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pt-2" data-slot="dashboard-toolbar">
      <ProjectSearch
        workspaceId={selection.workspace}
        from={selection.from}
        to={selection.to}
        projects={projects.data ?? []}
        picked={selection.projects}
        onPick={(id) => onFilters({ ...filters, projects: [...filters.projects, id] })}
        className="w-52"
      />
      {client && (
        <Badge variant="secondary" className="max-w-32 gap-1 pr-1" data-slot="client-filter">
          <span className="truncate">{client.name}</span>
          <button
            type="button"
            aria-label="Remove Client filter"
            className="rounded-sm hover:bg-foreground/10"
            onClick={() => onFilters({ ...filters, client: null })}
          >
            <RemoveBold className="size-4" />
          </button>
        </Badge>
      )}
      {!client && (clients.data?.length ?? 0) > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost-icon" size="icon-sm" aria-label="Add filter">
                  <Filter1 />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Filter by Client</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Client</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value=""
              onValueChange={(id) => onFilters({ ...filters, client: id })}
            >
              {clients.data?.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  {option.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {picked.map((project) => (
        <Badge
          key={project.id}
          variant="secondary"
          className="max-w-40 gap-1 pr-1"
          data-slot="picked-project"
        >
          <ProjectLabel project={project} />
          <button
            type="button"
            aria-label={`Remove ${project.name}`}
            className="rounded-sm hover:bg-foreground/10"
            onClick={() =>
              onFilters({
                ...filters,
                projects: filters.projects.filter((id) => id !== project.id),
              })
            }
          >
            <RemoveBold className="size-4" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
