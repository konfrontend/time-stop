import { useRef, useState } from 'react';
import ArrowButtonUp from '~icons/streamline-ultimate-color/arrow-button-up';
import type { Project } from '@app/domain';
import { ProjectPicker } from '@/components/ProjectPicker';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectComboboxProps {
  id?: string;
  // Shown before the name, where a bare name would not say what the button picks; it stands
  // in for the dropdown arrow.
  icon?: React.ReactNode;
  workspaceId: string;
  // The Workspace's Projects, Archived ones included.
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  align?: 'start' | 'center' | 'end';
  // What the button and the clearing item read with nothing picked.
  emptyLabel?: string;
  // False where picking is a view over Projects, not a choice of one to hold.
  creatable?: boolean;
  showArchived?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | undefined;
}

/**
 * The named button form of `ProjectPicker`: the current Project, marked by an arrow or an icon. A
 * name cut short by the width it gets shows whole in a Tooltip; one that fits carries none.
 */
export function ProjectCombobox({
  id,
  icon,
  workspaceId,
  projects,
  value,
  onChange,
  align = 'center',
  emptyLabel = 'No Project',
  creatable = true,
  showArchived = false,
  className,
  ...rest
}: ProjectComboboxProps) {
  const project = projects.find(({ id: projectId }) => projectId === value) ?? null;
  const label = project?.name ?? emptyLabel;
  const nameRef = useRef<HTMLSpanElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip
      open={tooltipOpen}
      onOpenChange={(open) =>
        setTooltipOpen(
          open && !!nameRef.current && nameRef.current.scrollWidth > nameRef.current.clientWidth,
        )
      }
    >
      <ProjectPicker
        workspaceId={workspaceId}
        projects={projects}
        value={value}
        align={align}
        emptyLabel={emptyLabel}
        creatable={creatable}
        showArchived={showArchived}
        onChange={onChange}
      >
        <TooltipTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="ghost"
            size="sm"
            role="combobox"
            aria-label="Project"
            data-slot="project-combobox"
            className={cn('min-w-0 gap-1', project || 'text-muted-foreground', className)}
            {...rest}
          >
            {icon}
            <span ref={nameRef} className="truncate">
              {label}
            </span>
            {project?.archived && (
              <span className="truncate font-normal text-muted-foreground">Archived</span>
            )}
            {!icon && <ArrowButtonUp className="size-3.5 rotate-180" />}
          </Button>
        </TooltipTrigger>
      </ProjectPicker>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
