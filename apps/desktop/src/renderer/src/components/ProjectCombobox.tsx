import ArrowButtonUp from '~icons/streamline-ultimate-color/arrow-button-up';
import type { Project } from '@time-stop/domain';
import { ProjectPicker } from '@/components/ProjectPicker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProjectComboboxProps {
  id?: string;
  workspaceId: string;
  // What can be picked; an Archived one the value already names should be included by the caller.
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | undefined;
}

/** The named button form of `ProjectPicker`: the current Project, with a dropdown arrow. */
export function ProjectCombobox({
  id,
  workspaceId,
  projects,
  value,
  onChange,
  align = 'center',
  className,
  ...rest
}: ProjectComboboxProps) {
  const project = projects.find(({ id: projectId }) => projectId === value) ?? null;

  return (
    <ProjectPicker
      workspaceId={workspaceId}
      projects={projects}
      value={value}
      align={align}
      onChange={onChange}
    >
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
        <span className="truncate">{project?.name ?? 'No Project'}</span>
        {project?.archived && (
          <span className="truncate font-normal text-muted-foreground">Archived</span>
        )}
        <ArrowButtonUp className="size-3.5 rotate-180" />
      </Button>
    </ProjectPicker>
  );
}
