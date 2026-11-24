import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  DB_DIR,
} from './collectionStore.js';
import path from 'node:path';
import crypto from 'node:crypto';

const DISTRICTS_PATH = path.join(DB_DIR, 'districts.json');

/** §4.1 — Initial district catalogue (name | alias). */
export const DEFAULT_DISTRICTS = [
  { id: 'dst-001', name: 'Nicosia', greekName: 'Λευκωσία', alias: 'NIC', order: 1 },
  { id: 'dst-002', name: 'Limassol', greekName: 'Λεμεσός', alias: 'LIM', order: 2 },
  { id: 'dst-003', name: 'Larnaca', greekName: 'Λάρνακα', alias: 'LCA', order: 3 },
  { id: 'dst-004', name: 'Paphos', greekName: 'Πάφος', alias: 'PFO', order: 4 },
  { id: 'dst-005', name: 'Famagusta', greekName: 'Αμμόχωστος', alias: 'FAM', order: 5 },
];

const DISTRICT_ALIAS_BY_NAME = Object.fromEntries(
  DEFAULT_DISTRICTS.map((district) => [district.name.toLowerCase(), district.alias]),
);

const DISTRICT_ALIAS_BY_ID = Object.fromEntries(
  DEFAULT_DISTRICTS.map((district) => [district.id, district.alias]),
);

const DISTRICT_GREEK_BY_ID = Object.fromEntries(
  DEFAULT_DISTRICTS.map((district) => [district.id, district.greekName]),
);

function readDistrictsFile() {
  ensureCollectionFile('districts', { districts: [] });
  return readCollection('districts', { districts: [] });
}

function writeDistrictsFile(data) {
  writeCollection('districts', data);
}

function generateDistrictId() {
  return `dst-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeDistrictAlias(alias, fallbackName = '', fallbackId = '') {
  if (typeof alias === 'string' && alias.trim()) {
    return alias.trim().toUpperCase();
  }
  const byId = DISTRICT_ALIAS_BY_ID[fallbackId];
  if (byId) return byId;
  const byName = DISTRICT_ALIAS_BY_NAME[fallbackName.trim().toLowerCase()];
  return byName ?? '';
}

function normalizeGreekName(greekName, fallbackId = '') {
  if (typeof greekName === 'string' && greekName.trim()) {
    return greekName.trim();
  }
  return DISTRICT_GREEK_BY_ID[fallbackId] ?? '';
}

function normalizeForScheduling(value, enabledFallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'yes' || value === 'true' || value === 1 || value === '1') return true;
  if (value === 'no' || value === 'false' || value === 0 || value === '0') return false;
  return enabledFallback !== false;
}

function migrateDistrictRecord(district, index) {
  const now = new Date().toISOString();
  const name = typeof district.name === 'string' ? district.name.trim() : '';
  const id = district.id ?? generateDistrictId();

  return {
    id,
    name,
    greekName: normalizeGreekName(district.greekName ?? district.nameEl, id),
    alias: normalizeDistrictAlias(district.alias, name, id),
    forScheduling: normalizeForScheduling(district.forScheduling, district.enabled),
    createdAt: district.createdAt ?? now,
    updatedAt: district.updatedAt ?? now,
    order: Number.isFinite(Number(district.order)) ? Number(district.order) : index + 1,
  };
}

function seedDistrictsIfEmpty() {
  const data = readDistrictsFile();
  if ((data.districts ?? []).length > 0) {
    return;
  }

  const now = new Date().toISOString();
  writeDistrictsFile({
    districts: DEFAULT_DISTRICTS.map((district) => ({
      ...district,
      forScheduling: true,
      createdAt: now,
      updatedAt: now,
    })),
  });
}

export function migrateDistricts() {
  seedDistrictsIfEmpty();
  const data = readDistrictsFile();
  let changed = false;
  data.districts = (data.districts ?? []).map((district, index) => {
    const migrated = migrateDistrictRecord(district, index);
    if (JSON.stringify(migrated) !== JSON.stringify(district)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeDistrictsFile(data);
  }
  return data;
}

export function ensureDistrictsDatabase() {
  ensureCollectionFile('districts', { districts: [] });
  migrateDistricts();
}

export function listDistricts() {
  const data = readDistrictsFile();
  return (data.districts ?? [])
    .filter((district) => district.forScheduling !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.alias.localeCompare(b.alias))
    .map((district) => ({
      id: district.id,
      name: district.name,
      greekName: district.greekName ?? '',
      alias: district.alias,
    }));
}

export function listDistrictRecords() {
  const data = readDistrictsFile();
  return (data.districts ?? [])
    .map((district) => ({
      id: district.id,
      name: district.name,
      greekName: district.greekName ?? '',
      alias: district.alias,
      forScheduling: district.forScheduling !== false,
      order: district.order ?? 0,
      createdAt: district.createdAt,
      updatedAt: district.updatedAt,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.alias.localeCompare(b.alias));
}

export function findDistrictById(districtId) {
  if (!districtId) return null;
  const data = readDistrictsFile();
  return data.districts.find((row) => row.id === districtId) ?? null;
}

function toPublicDistrict(district) {
  return {
    id: district.id,
    name: district.name,
    greekName: district.greekName ?? '',
    alias: district.alias,
    forScheduling: district.forScheduling !== false,
    order: district.order ?? 0,
    createdAt: district.createdAt,
    updatedAt: district.updatedAt,
  };
}

function validateDistrictInput(input, { existingId = null } = {}) {
  const errors = [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const greekName = typeof input.greekName === 'string' ? input.greekName.trim() : '';
  const alias = normalizeDistrictAlias(input.alias);
  const forScheduling = normalizeForScheduling(input.forScheduling, true);

  if (!name) errors.push('districtNameRequired');
  if (!alias) errors.push('districtAliasRequired');

  const data = readDistrictsFile();
  const nameOwner = (data.districts ?? []).find(
    (row) => row.name.toLowerCase() === name.toLowerCase() && row.id !== existingId,
  );
  if (name && nameOwner) errors.push('districtNameTaken');

  const aliasOwner = (data.districts ?? []).find(
    (row) => row.alias.toLowerCase() === alias.toLowerCase() && row.id !== existingId,
  );
  if (alias && aliasOwner) errors.push('districtAliasTaken');

  if (errors.length > 0) {
    return { errors };
  }

  return { value: { name, greekName, alias, forScheduling } };
}

export function findDistrictRecordById(districtId) {
  const district = findDistrictById(districtId);
  if (!district) return null;
  return toPublicDistrict(district);
}

export function createDistrict(input) {
  const validation = validateDistrictInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readDistrictsFile();
  const now = new Date().toISOString();
  const maxOrder = (data.districts ?? []).reduce(
    (max, row) => Math.max(max, Number(row.order) || 0),
    0,
  );
  const district = {
    id: generateDistrictId(),
    name: validation.value.name,
    greekName: validation.value.greekName,
    alias: validation.value.alias,
    forScheduling: validation.value.forScheduling,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  data.districts.push(district);
  writeDistrictsFile(data);
  return { district: toPublicDistrict(district) };
}

export function updateDistrict(districtId, input) {
  const data = readDistrictsFile();
  const index = (data.districts ?? []).findIndex((row) => row.id === districtId);
  if (index === -1) {
    return { errors: ['districtNotFound'] };
  }

  const validation = validateDistrictInput(input, { existingId: districtId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.districts[index],
    name: validation.value.name,
    greekName: validation.value.greekName,
    alias: validation.value.alias,
    forScheduling: validation.value.forScheduling,
    updatedAt: new Date().toISOString(),
  };

  data.districts[index] = updated;
  writeDistrictsFile(data);
  return { district: toPublicDistrict(updated) };
}

function districtHasAllocatedProjects(districtId) {
  const data = readCollection('projects', { projects: [] });
  return (data.projects ?? []).some((project) => project.districtId === districtId);
}

export function deleteDistrict(districtId) {
  const data = readDistrictsFile();
  const index = (data.districts ?? []).findIndex((row) => row.id === districtId);
  if (index === -1) {
    return { errors: ['districtNotFound'] };
  }

  if (districtHasAllocatedProjects(districtId)) {
    return { errors: ['districtHasProjects'] };
  }

  const [removed] = data.districts.splice(index, 1);
  writeDistrictsFile(data);
  return { district: toPublicDistrict(removed) };
}
