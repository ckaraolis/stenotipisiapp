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

const REFERENCES_PATH = path.join(__dirname, '..', 'database', 'userReferences.json');

function readReferencesFile() {
  ensureCollectionFile('userReferences', { references: [] });
  return readCollection('userReferences', { references: [] });
}

export function userHasSystemRecords(userId) {
  const data = readReferencesFile();
  const refs = data.references?.[userId];
  if (Array.isArray(refs)) {
    return refs.length > 0;
  }
  return typeof refs === 'number' ? refs > 0 : false;
}

export function getUserRecordCount(userId) {
  const data = readReferencesFile();
  const refs = data.references?.[userId];
  if (Array.isArray(refs)) {
    return refs.length;
  }
  return typeof refs === 'number' ? refs : 0;
}
