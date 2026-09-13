import { useId } from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import type { BillableFilter, Filters } from '@/lib/dashboardSearch';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const billableOptions: ReadonlyArray<{ value: BillableFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Billable' },
  { value: 'no', label: 'Non-billable' },
];

/** Workspace, Project, Client and Billable; picking a Workspace drops the other two. */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const id = useId();
  const workspaces = useWorkspaces();
  const projects = useProjects(filters.workspace ? { workspaceId: filters.workspace } : {});
  const clients = useClients(filters.workspace);

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="filter-bar">
      <Field className="w-auto">
        <FieldLabel htmlFor={`${id}-workspace`} className="sr-only">
          Workspace filter
        </FieldLabel>
        <Select
          value={toSelectValue(filters.workspace)}
          onValueChange={(value) =>
            onChange({
              ...filters,
              workspace: fromSelectValue(value) || null,
              project: null,
              client: null,
            })
          }
        >
          <SelectTrigger id={`${id}-workspace`} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All Workspaces</SelectItem>
            {workspaces.data?.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor={`${id}-project`} className="sr-only">
          Project filter
        </FieldLabel>
        <Select
          value={toSelectValue(filters.project)}
          onValueChange={(value) =>
            onChange({ ...filters, project: fromSelectValue(value) || null })
          }
        >
          <SelectTrigger id={`${id}-project`} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All Projects</SelectItem>
            {projects.data?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
                {project.archived ? ' (Archived)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor={`${id}-client`} className="sr-only">
          Client filter
        </FieldLabel>
        <Select
          value={toSelectValue(filters.client)}
          onValueChange={(value) =>
            onChange({ ...filters, client: fromSelectValue(value) || null })
          }
        >
          <SelectTrigger id={`${id}-client`} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All Clients</SelectItem>
            {clients.data?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Billable filter"
        value={filters.billable}
        onValueChange={(billable) =>
          billable && onChange({ ...filters, billable: billable as BillableFilter })
        }
      >
        {billableOptions.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
