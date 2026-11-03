import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';



function readReferencesFile() {
  ensureCollectionFile('customerReferences', { references: [] });
  return readCollection('customerReferences', { references: [] });
}

function getCustomerRefs(customerId) {
  const data = readReferencesFile();
  return data.references?.[customerId] ?? null;
}

export function customerHasProjects(customerId) {
  const refs = getCustomerRefs(customerId);
  const count = refs?.projects;
  if (Array.isArray(count)) return count.length > 0;
  return typeof count === 'number' ? count > 0 : false;
}

export function customerHasAllocatedJobs(customerId) {
  const refs = getCustomerRefs(customerId);
  const count = refs?.jobs;
  if (Array.isArray(count)) return count.length > 0;
  return typeof count === 'number' ? count > 0 : false;
}

function writeReferencesFile(data) {
  writeCollection('customerReferences', data);
}

export function syncCustomerProjectReferences(projects) {
  const data = readReferencesFile();
  const counts = {};
  for (const project of projects ?? []) {
    if (!project?.customerId) continue;
    counts[project.customerId] = (counts[project.customerId] ?? 0) + 1;
  }

  const references = { ...(data.references ?? {}) };
  for (const customerId of Object.keys(references)) {
    if (counts[customerId]) {
      references[customerId] = { ...references[customerId], projects: counts[customerId] };
    } else if (references[customerId]) {
      const next = { ...references[customerId] };
      delete next.projects;
      if (Object.keys(next).length === 0) {
        delete references[customerId];
      } else {
        references[customerId] = next;
      }
    }
  }

  for (const [customerId, count] of Object.entries(counts)) {
    references[customerId] = { ...(references[customerId] ?? {}), projects: count };
  }

  writeReferencesFile({ references });
}
