import { useState } from 'react';
import { Check, ChevronDown, Gem } from 'lucide-react';
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
  const setContext = useSetContext();
  const billable = isBillable({ project, currency: workspace.currency });

  function pick(projectId: string | null) {
    setOpen(false);
    setContext.mutate({ workspaceId: workspace.id, projectId });
  }

  return (
    <div className="flex max-w-full items-center gap-2" data-slot="project-picker">
      <Popover open={open} onOpenChange={setOpen}>
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
            <CommandInput placeholder="Find a Project…" />
            <CommandList>
              <CommandEmpty>No Project found.</CommandEmpty>
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
