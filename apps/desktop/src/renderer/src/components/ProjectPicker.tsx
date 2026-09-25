import { useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import Check from '~icons/streamline-ultimate-color/check';
import { acceptsRecords } from '@app/domain';
import type { Project } from '@app/domain';
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
import { projectFormValues, toProjectFields } from '@/lib/projectForm';
import { cn } from '@/lib/utils';

interface ProjectPickerProps {
  workspaceId: string;
  // The Workspace's Projects, Archived ones included; the picker decides which are on offer.
  projects: Project[];
  // Undefined where nothing is held yet, as when moving several Records at once.
  value?: string | null;
  onChange: (projectId: string | null) => void;
  align?: 'start' | 'center' | 'end';
  // What the item that clears the value reads; a filter calls it "All Projects".
  emptyLabel?: string;
  // False where picking is a view over Projects, not a choice of one to hold.
  creatable?: boolean;
  // A filter reaches the Records of Archived Projects too; a choice offers only the held one.
  showArchived?: boolean;
  // What opens the list: a `ProjectCombobox` button, or the dial's ring control.
  children: React.ReactNode;
}

/**
 * The list a Project is picked from, hung on the caller's trigger. An Archived Project accepts no
 * new Records, so it is left out unless the value already names it. A typed name with no match
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
  showArchived = false,
  children,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = showArchived
    ? projects
    : projects.filter((option) => acceptsRecords(option) || option.id === value);

  function pick(projectId: string | null) {
    setOpen(false);
    setQuery('');
    onChange(projectId);
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
                <CreateProject workspaceId={workspaceId} name={query} onCreated={pick} />
              </CommandEmpty>
            ) : (
              <CommandEmpty>No Project matches.</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem value="" onSelect={() => pick(null)} className="text-muted-foreground">
                <Check className={cn('size-5', value !== null && 'invisible')} />
                {emptyLabel}
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => pick(option.id)}>
                  <Check className={cn('size-5', option.id !== value && 'invisible')} />
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

function CreateProject({
  workspaceId,
  name,
  onCreated,
}: {
  workspaceId: string;
  name: string;
  onCreated: (projectId: string) => void;
}) {
  const createProject = useCreateProject();

  function create() {
    createProject
      .mutateAsync({
        ...toProjectFields({ ...projectFormValues(undefined, randomColor()), name }),
        workspaceId,
      })
      .then(
        (created) => onCreated(created.id),
        () => {},
      );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start font-normal"
      disabled={name.trim() === '' || createProject.isPending}
      onClick={create}
    >
      <AddCircleBold />
      <span className="truncate">Create “{name.trim()}”</span>
    </Button>
  );
}
