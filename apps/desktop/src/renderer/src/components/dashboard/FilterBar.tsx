import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import type { BillableFilter, Filters } from '@/lib/dashboardSearch';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const billableOptions: Array<{ value: BillableFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Billable' },
  { value: 'no', label: 'Non-billable' },
];

/** Workspace, Project, Client and Billable; picking a Workspace drops the other two. */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const workspaces = useWorkspaces();
  const projects = useProjects(filters.workspace ? { workspaceId: filters.workspace } : {});
  const clients = useClients(filters.workspace);

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="filter-bar">
      <NativeSelect
        aria-label="Workspace filter"
        size="sm"
        value={filters.workspace ?? ''}
        onChange={(event) =>
          onChange({
            ...filters,
            workspace: event.target.value || null,
            project: null,
            client: null,
          })
        }
      >
        <NativeSelectOption value="">All Workspaces</NativeSelectOption>
        {workspaces.data?.map((workspace) => (
          <NativeSelectOption key={workspace.id} value={workspace.id}>
            {workspace.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Project filter"
        size="sm"
        value={filters.project ?? ''}
        onChange={(event) => onChange({ ...filters, project: event.target.value || null })}
      >
        <NativeSelectOption value="">All Projects</NativeSelectOption>
        {projects.data?.map((project) => (
          <NativeSelectOption key={project.id} value={project.id}>
            {project.name}
            {project.archived ? ' (Archived)' : ''}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Client filter"
        size="sm"
        value={filters.client ?? ''}
        onChange={(event) => onChange({ ...filters, client: event.target.value || null })}
      >
        <NativeSelectOption value="">All Clients</NativeSelectOption>
        {clients.data?.map((client) => (
          <NativeSelectOption key={client.id} value={client.id}>
            {client.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex rounded-md bg-muted p-0.5" role="group" aria-label="Billable filter">
        {billableOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filters.billable === option.value}
            onClick={() => onChange({ ...filters, billable: option.value })}
            className={cn(
              'rounded-sm px-2 py-1 text-xs font-medium',
              filters.billable === option.value
                ? 'bg-background shadow-xs'
                : 'text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
