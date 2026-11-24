import crypto from 'node:crypto';
import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import { findCustomerById, listCustomerRecords } from './customers.js';

function readProjectTypesFile() {
  ensureCollectionFile('projectTypes', { projectTypes: [] });
  return readCollection('projectTypes', { projectTypes: [] });
}

function writeProjectTypesFile(data) {
  writeCollection('projectTypes', data);
}

function generateProjectTypeId() {
  return `pty-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeEnabled(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['enabled', 'enable', 'yes', 'true', '1', 'active'].includes(normalized)) return true;
    if (['disabled', 'disable', 'no', 'false', '0', 'inactive'].includes(normalized)) return false;
  }
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}

function migrateProjectTypeRecord(row) {
  const now = new Date().toISOString();
  return {
    id: row.id ?? generateProjectTypeId(),
    customerId: typeof row.customerId === 'string' ? row.customerId : '',
    type: typeof row.type === 'string' ? row.type.trim() : '',
    alias: typeof row.alias === 'string' ? row.alias.trim() : '',
    transcriptText: typeof row.transcriptText === 'string' ? row.transcriptText.trim() : '',
    enabled: normalizeEnabled(row.enabled, true),
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now,
  };
}

export function migrateProjectTypes() {
  const data = readProjectTypesFile();
  let changed = false;
  data.projectTypes = (data.projectTypes ?? []).map((row) => {
    const migrated = migrateProjectTypeRecord(row);
    if (JSON.stringify(migrated) !== JSON.stringify(row)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeProjectTypesFile(data);
  }
  return data;
}

export function ensureProjectTypesDatabase() {
  ensureCollectionFile('projectTypes', { projectTypes: [] });
  migrateProjectTypes();
}

function resolveCustomerName(customerId) {
  const customer = findCustomerById(customerId);
  return customer?.name ?? '';
}

function toPublicProjectType(row) {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: resolveCustomerName(row.customerId),
    type: row.type,
    alias: row.alias,
    transcriptText: row.transcriptText ?? '',
    enabled: row.enabled !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listProjectTypeRecords() {
  const data = readProjectTypesFile();
  return (data.projectTypes ?? [])
    .map((row) => toPublicProjectType(row))
    .sort((a, b) => {
      const customerCompare = a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: 'base',
      });
      if (customerCompare !== 0) return customerCompare;
      return a.type.localeCompare(b.type, undefined, { sensitivity: 'base' });
    });
}

export function listProjectTypeOptions({ customerId = null, enabledOnly = true } = {}) {
  return listProjectTypeRecords().filter((row) => {
    if (customerId && row.customerId !== customerId) return false;
    if (enabledOnly && !row.enabled) return false;
    return true;
  });
}

export function findProjectTypeById(projectTypeId) {
  if (!projectTypeId) return null;
  const data = readProjectTypesFile();
  return (data.projectTypes ?? []).find((row) => row.id === projectTypeId) ?? null;
}

export function findProjectTypeRecordById(projectTypeId) {
  const row = findProjectTypeById(projectTypeId);
  if (!row) return null;
  return toPublicProjectType(row);
}

function normalizeCompare(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function validateProjectTypeInput(input, { existingId = null } = {}) {
  const errors = [];
  const customerId = typeof input.customerId === 'string' ? input.customerId.trim() : '';
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  let alias = typeof input.alias === 'string' ? input.alias.trim() : '';
  const transcriptText =
    typeof input.transcriptText === 'string' ? input.transcriptText.trim() : '';
  const enabled = normalizeEnabled(input.enabled, true);

  if (!customerId) errors.push('projectTypeCustomerRequired');
  else if (!findCustomerById(customerId)) errors.push('projectTypeCustomerInvalid');
  if (!type) errors.push('projectTypeTypeRequired');
  if (!alias && type) {
    alias = type.slice(0, 12);
  }
  if (!alias) errors.push('projectTypeAliasRequired');

  const data = readProjectTypesFile();
  const duplicateType = (data.projectTypes ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.customerId === customerId &&
      normalizeCompare(row.type) === normalizeCompare(type),
  );
  if (type && duplicateType) errors.push('projectTypeTypeTaken');

  if (errors.length > 0) {
    return { errors };
  }

  return { value: { customerId, type, alias, transcriptText, enabled } };
}

export function createProjectType(input) {
  const validation = validateProjectTypeInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readProjectTypesFile();
  const now = new Date().toISOString();
  const projectType = {
    id: generateProjectTypeId(),
    ...validation.value,
    createdAt: now,
    updatedAt: now,
  };

  data.projectTypes.push(projectType);
  writeProjectTypesFile(data);
  return { projectType: toPublicProjectType(projectType) };
}

export function updateProjectType(projectTypeId, input) {
  const data = readProjectTypesFile();
  const index = (data.projectTypes ?? []).findIndex((row) => row.id === projectTypeId);
  if (index === -1) {
    return { errors: ['projectTypeNotFound'] };
  }

  const validation = validateProjectTypeInput(input, { existingId: projectTypeId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.projectTypes[index],
    ...validation.value,
    updatedAt: new Date().toISOString(),
  };

  data.projectTypes[index] = updated;
  writeProjectTypesFile(data);
  return { projectType: toPublicProjectType(updated) };
}

export function updateProjectTypeStatus(projectTypeId, enabled) {
  const data = readProjectTypesFile();
  const index = (data.projectTypes ?? []).findIndex((row) => row.id === projectTypeId);
  if (index === -1) {
    return { errors: ['projectTypeNotFound'] };
  }

  data.projectTypes[index] = {
    ...data.projectTypes[index],
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  };
  writeProjectTypesFile(data);
  return { projectType: toPublicProjectType(data.projectTypes[index]) };
}

function projectTypeHasProjects(projectTypeId) {
  const data = readCollection('projects', { projects: [] });
  return (data.projects ?? []).some((project) => project.projectTypeId === projectTypeId);
}

export function deleteProjectType(projectTypeId) {
  const data = readProjectTypesFile();
  const index = (data.projectTypes ?? []).findIndex((row) => row.id === projectTypeId);
  if (index === -1) {
    return { errors: ['projectTypeNotFound'] };
  }

  if (projectTypeHasProjects(projectTypeId)) {
    return { errors: ['projectTypeHasProjects'] };
  }

  const [removed] = data.projectTypes.splice(index, 1);
  writeProjectTypesFile(data);
  return { projectType: toPublicProjectType(removed) };
}

function findCustomerForImport(customerNameOrAlias) {
  const needle = normalizeCompare(customerNameOrAlias);
  if (!needle) return null;
  const customers = listCustomerRecords();
  const exact =
    customers.find((customer) => normalizeCompare(customer.name) === needle) ||
    customers.find((customer) => normalizeCompare(customer.alias) === needle);
  if (exact) return exact;

  // Fallback for truncated Excel names / trailing punctuation differences.
  if (needle.length < 6) return null;
  return (
    customers.find((customer) => {
      const name = normalizeCompare(customer.name);
      return name.startsWith(needle) || needle.startsWith(name);
    }) || null
  );
}

function normalizeImportRow(raw = {}) {
  const get = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
        return raw[key];
      }
    }
    const entries = Object.entries(raw);
    for (const key of keys) {
      const needle = String(key).trim().toLowerCase().replace(/[\s_]+/g, '');
      const match = entries.find(
        ([header]) => String(header).trim().toLowerCase().replace(/[\s_]+/g, '') === needle,
      );
      if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') {
        return match[1];
      }
    }
    return undefined;
  };

  return {
    customer: String(get('Customer', 'Customer Name', 'customer', 'customerName') ?? '').trim(),
    type: String(get('Type', 'Project Type', 'type') ?? '').trim(),
    alias: String(get('Alias', 'alias') ?? '').trim(),
    transcriptText: String(
      get('Transcript Text', 'TranscriptText', 'transcriptText', 'transcript') ?? '',
    ).trim(),
    enabled: normalizeEnabled(get('Status', 'Enabled', 'status', 'enabled'), true),
  };
}

/**
 * Import project types from Excel rows (ASTRAEA export shape).
 * Matching key: customer (name/alias) + type (case-insensitive).
 * Rows that share the same customer+alias but different types are kept as separate records.
 */
export function importProjectTypes(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  list.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = normalizeImportRow(rawRow);
    if (!row.customer && !row.type && !row.alias) {
      summary.skipped += 1;
      return;
    }

    const customer = findCustomerForImport(row.customer);
    if (!customer) {
      summary.errors.push({
        row: rowNumber,
        message: 'projectTypeCustomerInvalid',
        detail: row.customer || '',
      });
      summary.skipped += 1;
      return;
    }
    if (!row.type) {
      summary.errors.push({ row: rowNumber, message: 'projectTypeTypeRequired' });
      summary.skipped += 1;
      return;
    }

    const alias = row.alias || row.type.slice(0, 12);
    const data = readProjectTypesFile();
    const existing = (data.projectTypes ?? []).find(
      (item) =>
        item.customerId === customer.id &&
        normalizeCompare(item.type) === normalizeCompare(row.type),
    );

    const payload = {
      customerId: customer.id,
      type: row.type,
      alias,
      transcriptText: row.transcriptText,
      enabled: row.enabled,
    };

    if (existing) {
      const result = updateProjectType(existing.id, payload);
      if (result.errors) {
        summary.errors.push({
          row: rowNumber,
          message: result.errors[0],
          detail: row.type,
        });
        summary.skipped += 1;
        return;
      }
      summary.updated += 1;
      return;
    }

    const result = createProjectType(payload);
    if (result.errors) {
      summary.errors.push({
        row: rowNumber,
        message: result.errors[0],
        detail: row.type,
      });
      summary.skipped += 1;
      return;
    }
    summary.created += 1;
  });

  return summary;
}
