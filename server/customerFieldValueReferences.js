import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';



function readReferencesFile() {
  ensureCollectionFile('customerFieldValueReferences', { references: [] });
  return readCollection('customerFieldValueReferences', { references: [] });
}

export function customerFieldValueAssignedToProjects(fieldValueId) {
  const data = readReferencesFile();
  const refs = data.references?.[fieldValueId];
  if (Array.isArray(refs)) {
    return refs.length > 0;
  }
  return typeof refs === 'number' ? refs > 0 : false;
}

function writeReferencesFile(data) {
  writeCollection('customerFieldValueReferences', data);
}

export function syncFieldValueProjectReferences(projects) {
  const references = {};
  for (const project of projects ?? []) {
    if (project?.field1ValueId) {
      references[project.field1ValueId] = (references[project.field1ValueId] ?? 0) + 1;
    }
    if (project?.field2ValueId) {
      references[project.field2ValueId] = (references[project.field2ValueId] ?? 0) + 1;
    }
  }
  writeReferencesFile({ references });
}
