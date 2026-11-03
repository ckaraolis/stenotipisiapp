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

export function projectHasAllocatedJobs(projectId) {
  const data = readReferencesFile();
  const refs = data.references?.[projectId];
  const count = refs?.jobs;
  if (Array.isArray(count)) return count.length > 0;
  return typeof count === 'number' ? count > 0 : false;
}
