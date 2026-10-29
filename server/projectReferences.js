import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REFERENCES_PATH = path.join(__dirname, '..', 'database', 'projectReferences.json');

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
