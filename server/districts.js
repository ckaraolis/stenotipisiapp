import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DISTRICTS_PATH = path.join(DB_DIR, 'districts.json');
const PROJECTS_PATH = path.join(DB_DIR, 'projects.json');

/** §4.1 — Initial district catalogue (name | alias). */
export const DEFAULT_DISTRICTS = [
  { id: 'dst-001', name: 'Nicosia', alias: 'NIC', order: 1 },
  { id: 'dst-002', name: 'Limassol', alias: 'LIM', order: 2 },
  { id: 'dst-003', name: 'Larnaca', alias: 'LCA', order: 3 },
  { id: 'dst-004', name: 'Paphos', alias: 'PFO', order: 4 },
  { id: 'dst-005', name: 'Famagusta', alias: 'FAM', order: 5 },
];

const DISTRICT_ALIAS_BY_NAME = Object.fromEntries(
  DEFAULT_DISTRICTS.map((district) => [district.name.toLowerCase(), district.alias]),
);

const DISTRICT_ALIAS_BY_ID = Object.fromEntries(
  DEFAULT_DISTRICTS.map((district) => [district.id, district.alias]),
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

function migrateDistrictRecord(district, index) {
  const now = new Date().toISOString();
  const name = typeof district.name === 'string' ? district.name.trim() : '';
  const id = district.id ?? generateDistrictId();

  return {
    id,
    name,
    alias: normalizeDistrictAlias(district.alias, name, id),
    enabled: district.enabled !== false,
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
      enabled: true,
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
    .filter((district) => district.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    .map((district) => ({
      id: district.id,
      name: district.name,
      alias: district.alias,
    }));
}

export function listDistrictRecords() {
  const data = readDistrictsFile();
  return (data.districts ?? [])
    .map((district) => ({
      id: district.id,
      name: district.name,
      alias: district.alias,
      enabled: district.enabled !== false,
      order: district.order ?? 0,
      createdAt: district.createdAt,
      updatedAt: district.updatedAt,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
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
    alias: district.alias,
    enabled: district.enabled !== false,
    order: district.order ?? 0,
    createdAt: district.createdAt,
    updatedAt: district.updatedAt,
  };
}

function validateDistrictInput(input, { existingId = null } = {}) {
  const errors = [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const alias = normalizeDistrictAlias(input.alias);

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

  return { value: { name, alias } };
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
    alias: validation.value.alias,
    enabled: true,
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
    alias: validation.value.alias,
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
