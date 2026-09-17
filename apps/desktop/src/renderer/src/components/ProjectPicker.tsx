import { useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import Check from '~icons/streamline-ultimate-color/check';
import type { Project } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
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
import { randomColor } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface ProjectPickerProps {
  workspaceId: string;
  // What can be picked; an Archived one the value already names should be included by the caller.
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  align?: 'start' | 'center' | 'end';
  // What the item that clears the value reads; a filter calls it "All Projects".
  emptyLabel?: string;
  // False where picking is a view over Projects, not a choice of one to hold.
  creatable?: boolean;
  // What opens the list: a `ProjectCombobox` button, or the dial's ring control.
  children: React.ReactNode;
}

/**
 * The list a Project is picked from, hung on the caller's trigger. A typed name with no match
 * becomes a Project on the spot; the rest of it is filled in from Settings.
 */
export function ProjectPicker({
  workspaceId,
  projects,
  value,
  onChange,
  align = 'center',
  emptyLabel = 'No Project',
  creatable = true,
  children,
}: ProjectPickerProps) {
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
        color: randomColor(),
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
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Find a Project…" value={query} onValueChange={setQuery} />
          <CommandList>
            {creatable ? (
              <CommandEmpty className="p-1 text-left">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                  disabled={query.trim() === '' || createProject.isPending}
                  onClick={create}
                >
                  <AddCircleBold />
                  <span className="truncate">Create “{query.trim()}”</span>
                </Button>
              </CommandEmpty>
            ) : (
              <CommandEmpty>No Project matches.</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem value="" onSelect={() => pick(null)} className="text-muted-foreground">
                <Check className={cn('size-5', project && 'invisible')} />
                {emptyLabel}
              </CommandItem>
              {projects.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => pick(option.id)}>
                  <Check className={cn('size-5', option.id !== project?.id && 'invisible')} />
                  <ProjectLabel project={option} suffix={option.archived ? 'Archived' : null} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
