import type { Project } from '@time-stop/domain';

export interface ProjectHit {
  project: Project;
  // The Record Name that matched, when the Project's own did not.
  hint: string | null;
}

/**
 * Projects matching `query` by their Name, or by the Name of one of their Records; picked and
 * Archived Projects are left out. An empty query lists every remaining Project.
 */
export function findProjects(
  query: string,
  projects: readonly Project[],
  picked: readonly string[],
  rows: ReadonlyArray<{ record: { projectId: string | null; name: string } }>,
): ProjectHit[] {
  const q = query.trim().toLowerCase();
  const hits: ProjectHit[] = [];
  for (const project of projects) {
    if (picked.includes(project.id) || project.archived) continue;
    if (q === '' || project.name.toLowerCase().includes(q)) {
      hits.push({ project, hint: null });
      continue;
    }
    const named = rows.find(
      (row) => row.record.projectId === project.id && row.record.name.toLowerCase().includes(q),
    );
    if (named) hits.push({ project, hint: named.record.name });
  }
  return hits;
}
