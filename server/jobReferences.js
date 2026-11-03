import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';



function readReferencesFile() {
  ensureCollectionFile('projectReferences', { references: [] });
  return readCollection('projectReferences', { references: [] });
}

function writeReferencesFile(data) {
  writeCollection('projectReferences', data);
}

export function syncProjectJobReferences(jobs) {
  const data = readReferencesFile();
  const counts = {};
  for (const job of jobs ?? []) {
    if (!job?.projectId) continue;
    if (job.status === 'deleted') continue;
    counts[job.projectId] = (counts[job.projectId] ?? 0) + 1;
  }

  const references = { ...(data.references ?? {}) };
  for (const projectId of Object.keys(references)) {
    if (counts[projectId]) {
      references[projectId] = { ...references[projectId], jobs: counts[projectId] };
    } else if (references[projectId]) {
      const { jobs: _removed, ...rest } = references[projectId];
      if (Object.keys(rest).length > 0) {
        references[projectId] = rest;
      } else {
        delete references[projectId];
      }
    }
  }

  for (const [projectId, count] of Object.entries(counts)) {
    references[projectId] = { ...(references[projectId] ?? {}), jobs: count };
  }

  writeReferencesFile({ references });
}
