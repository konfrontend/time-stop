import { useRef, useState } from 'react';
import type { Project } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useDashboard } from '@/hooks/useDashboard';
import { findProjects } from '@/lib/projectSearch';
import { cn } from '@/lib/utils';

interface ProjectSearchProps {
  workspaceId: string;
  // The Range whose Record Names are searched too.
  from: string;
  to: string;
  projects: Project[];
  picked: string[];
  onPick: (projectId: string) => void;
  className?: string;
}

// cmdk's input wrapper restyled as a regular Input: bordered, filled, ring on focus.
const inputLook =
  'bg-transparent [&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input-wrapper]]:rounded-md [&_[data-slot=command-input-wrapper]]:border [&_[data-slot=command-input-wrapper]]:border-input [&_[data-slot=command-input-wrapper]]:bg-background [&_[data-slot=command-input-wrapper]]:shadow-xs [&_[data-slot=command-input-wrapper]]:transition-[color,box-shadow] dark:[&_[data-slot=command-input-wrapper]]:bg-input/30 [&_[data-slot=command-input-wrapper]:focus-within]:border-ring [&_[data-slot=command-input-wrapper]:focus-within]:ring-[3px] [&_[data-slot=command-input-wrapper]:focus-within]:ring-ring/50';

/**
 * Finds Projects by their Name or by the Name of a Record they hold in the Range; a hit through
 * a Record shows that Name under the Project. Picking one adds it to the filter.
 */
export function ProjectSearch({
  workspaceId,
  from,
  to,
  projects,
  picked,
  onPick,
  className,
}: ProjectSearchProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const records = useDashboard({ from, to, workspaceId }, open);
  const hits = findProjects(query, projects, picked, records.data?.rows ?? []);

  function pick(projectId: string) {
    setQuery('');
    setOpen(false);
    onPick(projectId);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false} className={cn(inputLook, className)} data-slot="project-search">
        <PopoverAnchor asChild>
          <div ref={anchor}>
            <CommandInput
              placeholder="Project or Name…"
              value={query}
              onValueChange={(next) => {
                setQuery(next);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              className="h-8"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-(--radix-popover-trigger-width) min-w-56 p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && anchor.current?.contains(target)) event.preventDefault();
          }}
        >
          <CommandList>
            <CommandEmpty>No Project matches.</CommandEmpty>
            {hits.map(({ project, hint }) => (
              <CommandItem
                key={project.id}
                value={project.id}
                onSelect={() => pick(project.id)}
                onMouseDown={(event) => event.preventDefault()}
                className="flex-col items-start gap-0"
              >
                <ProjectLabel project={project} />
                {hint && <span className="pl-3.5 text-xs text-muted-foreground">{hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
