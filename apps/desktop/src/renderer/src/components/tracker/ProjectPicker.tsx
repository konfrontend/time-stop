import { useState } from 'react';
import { Check, ChevronDown, Gem, Plus } from 'lucide-react';
import { isBillable } from '@time-stop/domain';
import type { Client, Project, Workspace } from '@time-stop/domain';
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
import { useSetContext } from '@/hooks/useContext';
import { useCreateProject } from '@/hooks/useProjects';
import { DEFAULT_COLOR } from '@/lib/projectForm';
import { cn } from '@/lib/utils';

interface ProjectPickerProps {
  workspace: Workspace;
  projects: Project[];
  project: Project | null;
  client: Client | null;
}

/** Picks the Context's Project; beside it the Client and, when the Project earns money, a gem. */
export function ProjectPicker({ workspace, projects, project, client }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setContext = useSetContext();
  const createProject = useCreateProject();
  const billable = isBillable({ project, currency: workspace.currency });

  function pick(projectId: string | null) {
    setOpen(false);
    setQuery('');
    setContext.mutate({ workspaceId: workspace.id, projectId });
  }

  // A typed name with no match becomes a Project on the spot; the rest is filled in from Settings.
  function create() {
    createProject
      .mutateAsync({
        workspaceId: workspace.id,
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
    <div className="flex max-w-full items-center gap-2" data-slot="project-picker">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label="Project"
            className={cn('min-w-0 gap-1', project || 'text-muted-foreground')}
          >
            <span className="truncate">{project?.name ?? 'No Project'}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="center">
          <Command>
            <CommandInput placeholder="Find a Project…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty className="p-1 text-left">
                <Button
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
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: option.color }}
                      aria-hidden
                    />
                    <span className="truncate">{option.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
