import type { ProjectRecord } from '../types/project';

/** §4.11.1.2 — Location options for the selected project (same customer + field 1). */
export function getLocationOptionsForProject(
  projectId: string,
  projects: readonly ProjectRecord[],
): string[] {
  const project = projects.find((row) => row.id === projectId);
  if (!project) return [];

  const relatedProjects = projects.filter((row) => {
    if (row.customerId !== project.customerId) return false;
    if (project.field1ValueId) {
      return row.field1ValueId === project.field1ValueId;
    }
    return row.id === project.id;
  });

  const values = new Set<string>();
  for (const row of relatedProjects) {
    if (row.field2Value.trim()) values.add(row.field2Value.trim());
    if (row.field3.trim()) values.add(row.field3.trim());
    const district = row.districtAlias.trim() || row.districtName.trim();
    if (district) values.add(district);
  }

  return [...values].sort((a, b) => a.localeCompare(b));
}
