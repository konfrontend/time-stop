import type { Project } from '@app/domain';
import { cn } from '@/lib/utils';

interface ProjectLabelProps {
  project: Pick<Project, 'name' | 'color'>;
  // Trails the Name in a muted color, e.g. the Client or "Archived".
  suffix?: string | null | undefined;
  className?: string | undefined;
}

/** The Project's colour as a small disc, then its Name. */
export function ProjectLabel({ project, suffix, className }: ProjectLabelProps) {
  return (
    <span data-slot="project-label" className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: project.color }}
        aria-hidden
      />
      <span className="truncate">{project.name}</span>
      {suffix && (
        <span className="min-w-0 shrink-[2] truncate font-normal text-muted-foreground">
          {suffix}
        </span>
      )}
    </span>
  );
}
