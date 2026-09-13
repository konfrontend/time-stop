import { Gem, Plus, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { ProjectDot } from '@/components/ProjectDot';
import { ProjectSearch } from './ProjectSearch';
import { RoundingPicker } from './RoundingPicker';

interface DashboardToolbarProps {
  selection: DashboardSelection;
  onFilters: (filters: Filters) => void;
  onRounding: (rounding: DashboardSelection['rounding']) => void;
}

/** One row: Project search, the Client chip, Billable and Rounding; picked Projects below it. */
export function DashboardToolbar({ selection, onFilters, onRounding }: DashboardToolbarProps) {
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
    <div className="flex flex-col gap-1.5 border-b px-3 py-2" data-slot="dashboard-toolbar">
      <div className="flex items-center gap-1">
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
              <X className="size-3" />
            </button>
          </Badge>
        )}
        {!client && (clients.data?.length ?? 0) > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Add filter">
                    <Plus />
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
        <span className="ml-auto" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Billable only"
              aria-pressed={selection.billable}
              className={cn(
                'text-muted-foreground',
                selection.billable && 'bg-accent text-accent-foreground dark:bg-accent/50',
              )}
              onClick={() => onFilters({ ...filters, billable: !selection.billable })}
            >
              <Gem />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Billable only</TooltipContent>
        </Tooltip>
        <RoundingPicker value={selection.rounding} onChange={onRounding} />
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1" data-slot="picked-projects">
          {picked.map((project) => (
            <Badge key={project.id} variant="secondary" className="max-w-40 gap-1 pr-1">
              <ProjectDot project={project} />
              <span className="truncate">{project.name}</span>
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
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
