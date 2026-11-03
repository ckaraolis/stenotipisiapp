import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';



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
