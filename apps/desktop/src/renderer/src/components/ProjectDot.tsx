import type { Project } from '@time-stop/domain';

/** The Project's colour as a small disc beside its Name. */
export function ProjectDot({ project }: { project: Pick<Project, 'color'> }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: project.color }}
      aria-hidden
    />
  );
}
