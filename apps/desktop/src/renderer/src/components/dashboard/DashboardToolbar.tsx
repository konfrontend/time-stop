import { ArrowUpDown, Gem, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import type { DashboardSelection, Filters, Sort, SortDir, SortKey } from '@/lib/dashboardSearch';
import { ProjectSearch } from './ProjectSearch';
import { RoundingPicker } from './RoundingPicker';

interface DashboardToolbarProps {
  selection: DashboardSelection;
  onFilters: (filters: Filters) => void;
  onRounding: (rounding: DashboardSelection['rounding']) => void;
  onSort: (sort: Sort) => void;
}

const sortKeys: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'start', label: 'Start' },
  { value: 'name', label: 'Name' },
  { value: 'project', label: 'Project' },
  { value: 'duration', label: 'Duration' },
  { value: 'amount', label: 'Amount' },
];

/** One row: Project search, the Client chip, Billable and Rounding; picked Projects above it. */
export function DashboardToolbar({
  selection,
  onFilters,
  onRounding,
  onSort,
}: DashboardToolbarProps) {
  const projects = useProjects({ workspaceId: selection.workspace });
  const clients = useClients(selection.workspace);
  const filters: Filters = {
    projects: selection.projects,
    client: selection.client,
    billable: selection.billable,
  };
  const pickedNames = selection.projects
    .map((id) => projects.data?.find((p) => p.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const client = clients.data?.find((c) => c.id === selection.client) ?? null;

  return (
    <div className="flex flex-col gap-1 border-b px-3 py-2" data-slot="dashboard-toolbar">
      {selection.projects.length > 0 && (
        <div className="flex items-center gap-2 text-sm" data-slot="picked-projects">
          <span className="min-w-0 flex-1 truncate">{pickedNames.join(', ')}</span>
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0"
            onClick={() => onFilters({ ...filters, projects: [] })}
          >
            Clear
          </Button>
        </div>
      )}
      <div className="flex items-center gap-1">
        <ProjectSearch
          workspaceId={selection.workspace}
          from={selection.from}
          to={selection.to}
          projects={projects.data ?? []}
          picked={selection.projects}
          onPick={(id) => onFilters({ ...filters, projects: [...filters.projects, id] })}
          className="min-w-0 flex-1"
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
            <Toggle
              size="sm"
              aria-label="Billable only"
              className="text-muted-foreground data-[state=on]:text-accent-foreground"
              pressed={selection.billable}
              onPressedChange={(billable) => onFilters({ ...filters, billable })}
            >
              <Gem />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Billable only</TooltipContent>
        </Tooltip>
        <RoundingPicker value={selection.rounding} onChange={onRounding} />
        <SortMenu sort={selection} onSort={onSort} />
      </div>
    </div>
  );
}

function SortMenu({ sort, onSort }: { sort: Sort; onSort: (sort: Sort) => void }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Sort">
              <ArrowUpDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Sort</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.sort}
          onValueChange={(key) => onSort({ ...sort, sort: key as SortKey })}
        >
          {sortKeys.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={sort.dir}
          onValueChange={(dir) => onSort({ ...sort, dir: dir as SortDir })}
        >
          <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
