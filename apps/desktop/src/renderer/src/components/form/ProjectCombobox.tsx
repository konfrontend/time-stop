import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { Project } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateProject } from '@/hooks/useProjects';
import { DEFAULT_COLOR } from '@/lib/projectForm';
import { cn } from '@/lib/utils';
import { ProjectDot } from '@/components/ProjectDot';

interface ProjectComboboxProps {
  id?: string;
  workspaceId: string;
  // What can be picked; an Archived one the value already names should be included by the caller.
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  variant?: 'ghost' | 'outline';
  align?: 'start' | 'center' | 'end';
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | undefined;
}

/**
 * Picks a Project of the Workspace, or none. A typed name with no match becomes a Project on
 * the spot; the rest of it is filled in from Settings.
 */
export function ProjectCombobox({
  id,
  workspaceId,
  projects,
  value,
  onChange,
  variant = 'ghost',
  align = 'center',
  className,
  ...rest
}: ProjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const createProject = useCreateProject();
  const project = projects.find(({ id }) => id === value) ?? null;

  function pick(projectId: string | null) {
    setOpen(false);
    setQuery('');
    onChange(projectId);
  }

  function create() {
    createProject
      .mutateAsync({
        workspaceId,
        clientId: null,
        name: query.trim(),
        rate: null,
        limitMin: null,
        limitMax: null,
        limitPeriod: null,
        startDate: null,
        endDate: null,
        color: DEFAULT_COLOR,
      })
      .then(
        (created) => pick(created.id),
        () => {},
      );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={variant}
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Project"
          data-slot="project-combobox"
          className={cn(
            'min-w-0 gap-1',
            variant === 'outline' && 'h-9 justify-between font-normal',
            project || 'text-muted-foreground',
            className,
          )}
          {...rest}
        >
          <span className="truncate">
            {project ? `${project.name}${project.archived ? ' (Archived)' : ''}` : 'No Project'}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Find a Project…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="p-1 text-left">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                disabled={query.trim() === '' || createProject.isPending}
                onClick={create}
              >
                <Plus />
                <span className="truncate">Create “{query.trim()}”</span>
              </Button>
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value="" onSelect={() => pick(null)} className="text-muted-foreground">
                <Check className={cn('size-4', project && 'invisible')} />
                No Project
              </CommandItem>
              {projects.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => pick(option.id)}>
                  <Check className={cn('size-4', option.id !== project?.id && 'invisible')} />
                  <ProjectDot project={option} />
                  <span className="truncate">
                    {option.name}
                    {option.archived ? ' (Archived)' : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
