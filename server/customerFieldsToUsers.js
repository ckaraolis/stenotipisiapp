import crypto from 'node:crypto';
import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import { findCustomerById, listCustomerFieldValues, listCustomerRecords } from './customers.js';
import { findUserByUsername, listUsers } from './db.js';

function readMappingsFile() {
  ensureCollectionFile('customerFieldsToUsers', { mappings: [] });
  return readCollection('customerFieldsToUsers', { mappings: [] });
}

function writeMappingsFile(data) {
  writeCollection('customerFieldsToUsers', data);
}

function generateMappingId() {
  return `cfu-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeCompare(value) {
  return normalizeText(value)
    .toLocaleLowerCase('el-GR')
    .normalize('NFC')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandTwoDigitYear(yearText) {
  const year = Number.parseInt(yearText, 10);
  if (!Number.isFinite(year)) return '';
  if (yearText.length === 4) return String(year);
  if (yearText.length !== 2) return '';
  return String(year >= 70 ? 1900 + year : 2000 + year);
}

function excelSerialToIso(serial) {
  const numeric = Number(serial);
  if (!Number.isFinite(numeric) || numeric < 20000 || numeric > 80000) return '';
  const utc = Date.UTC(1899, 11, 30) + Math.round(numeric) * 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function ymdFromParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return '';
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dateObjectToIso(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  // Prefer UTC calendar day (Excel/cellDates usually stores UTC midnight).
  return ymdFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function normalizeValidityFrom(value) {
  if (value instanceof Date) {
    return dateObjectToIso(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromSerial = excelSerialToIso(value);
    if (fromSerial) return fromSerial;
  }

  const text = normalizeText(value);
  if (!text) return '';

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const fromSerial = excelSerialToIso(text);
    if (fromSerial) return fromSerial;
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (ymd) {
    const iso = ymdFromParts(ymd[1], ymd[2], ymd[3]);
    if (iso) return iso;
  }

  // DD/MM/YYYY (Cyprus/EU) first; fall back to MM/DD/YYYY for US-formatted Excel exports.
  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s|$|T)/.exec(`${text} `);
  if (slash) {
    const year = expandTwoDigitYear(slash[3]);
    const dmy = ymdFromParts(year, slash[2], slash[1]);
    if (dmy) return dmy;
    const mdy = ymdFromParts(year, slash[1], slash[2]);
    if (mdy) return mdy;
  }

  return '';
}

function normalizeUserIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((id) => normalizeText(id)).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [
      ...new Set(
        value
          .split(/[,;/|]+/)
          .map((part) => normalizeText(part))
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

function resolveUserIdsFromLabels(labels) {
  const ids = [];
  const missing = [];
  for (const label of normalizeUserIds(labels)) {
    const byId = listUsers().find((user) => user.id === label);
    if (byId) {
      ids.push(byId.id);
      continue;
    }
    const byUsername = findUserByUsername(label);
    if (byUsername) {
      ids.push(byUsername.id);
      continue;
    }
    missing.push(label);
  }
  return { userIds: [...new Set(ids)], missing };
}

function migrateMappingRecord(row) {
  const now = new Date().toISOString();
  return {
    id: row.id ?? generateMappingId(),
    customerId: typeof row.customerId === 'string' ? row.customerId : '',
    fieldName: normalizeText(row.fieldName),
    fieldValue: normalizeText(row.fieldValue),
    fieldValueId: typeof row.fieldValueId === 'string' ? row.fieldValueId : null,
    userIds: normalizeUserIds(row.userIds ?? row.users),
    validityFrom: normalizeValidityFrom(row.validityFrom) || now.slice(0, 10),
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now,
  };
}

export function migrateCustomerFieldsToUsers() {
  const data = readMappingsFile();
  let changed = false;
  data.mappings = (data.mappings ?? []).map((row) => {
    const migrated = migrateMappingRecord(row);
    if (JSON.stringify(migrated) !== JSON.stringify(row)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeMappingsFile(data);
  }
  return data;
}

export function ensureCustomerFieldsToUsersDatabase() {
  ensureCollectionFile('customerFieldsToUsers', { mappings: [] });
  migrateCustomerFieldsToUsers();
}

function resolveCustomerName(customerId) {
  return findCustomerById(customerId)?.name ?? '';
}

function resolveUserAliases(userIds) {
  const users = listUsers();
  return userIds
    .map((id) => users.find((user) => user.id === id)?.username ?? '')
    .filter(Boolean);
}

function toPublicMapping(row) {
  const userAliases = resolveUserAliases(row.userIds ?? []);
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: resolveCustomerName(row.customerId),
    fieldName: row.fieldName ?? '',
    fieldValue: row.fieldValue ?? '',
    fieldValueId: row.fieldValueId ?? null,
    userIds: row.userIds ?? [],
    userAliases,
    usersLabel: userAliases.join(', '),
    validityFrom: row.validityFrom,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCustomerFieldUserMappings() {
  const data = readMappingsFile();
  return (data.mappings ?? [])
    .map((row) => toPublicMapping(row))
    .sort((a, b) => {
      const customerCompare = a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: 'base',
      });
      if (customerCompare !== 0) return customerCompare;
      const valueCompare = a.fieldValue.localeCompare(b.fieldValue, undefined, {
        sensitivity: 'base',
      });
      if (valueCompare !== 0) return valueCompare;
      return String(a.validityFrom).localeCompare(String(b.validityFrom));
    });
}

export function listCustomerFieldUserMappingUserOptions() {
  return listUsers()
    .filter((user) => user.status === 'active')
    .map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
    }))
    .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
}

export function findCustomerFieldUserMappingById(mappingId) {
  if (!mappingId) return null;
  const data = readMappingsFile();
  return (data.mappings ?? []).find((row) => row.id === mappingId) ?? null;
}

export function findCustomerFieldUserMappingRecordById(mappingId) {
  const row = findCustomerFieldUserMappingById(mappingId);
  if (!row) return null;
  return toPublicMapping(row);
}

function findFieldValueId(customerId, fieldValue) {
  const result = listCustomerFieldValues(customerId, 2);
  if (result.errors) return null;
  const needle = normalizeCompare(fieldValue);
  const match = (result.values ?? []).find((entry) => normalizeCompare(entry.value) === needle);
  return match?.id ?? null;
}

function validateMappingInput(input, { existingId = null } = {}) {
  const errors = [];
  const customerId = normalizeText(input.customerId);
  const fieldName = normalizeText(input.fieldName);
  const fieldValue = normalizeText(input.fieldValue);
  const validityFrom = normalizeValidityFrom(input.validityFrom);
  const resolvedUsers = resolveUserIdsFromLabels(input.userIds ?? input.users ?? []);

  if (!customerId) errors.push('customerFieldUserCustomerRequired');
  else if (!findCustomerById(customerId)) errors.push('customerFieldUserCustomerInvalid');
  if (!fieldValue) errors.push('customerFieldUserFieldValueRequired');
  if (!validityFrom) errors.push('customerFieldUserValidityFromRequired');
  if (resolvedUsers.userIds.length === 0) errors.push('customerFieldUserUsersRequired');
  if (resolvedUsers.missing.length > 0) errors.push('customerFieldUserUsersInvalid');

  const data = readMappingsFile();
  const duplicate = (data.mappings ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.customerId === customerId &&
      normalizeCompare(row.fieldValue) === normalizeCompare(fieldValue) &&
      row.validityFrom === validityFrom,
  );
  if (customerId && fieldValue && validityFrom && duplicate) {
    errors.push('customerFieldUserDuplicate');
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      customerId,
      fieldName,
      fieldValue,
      fieldValueId: findFieldValueId(customerId, fieldValue),
      userIds: resolvedUsers.userIds,
      validityFrom,
    },
  };
}

export function createCustomerFieldUserMapping(input) {
  const validation = validateMappingInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readMappingsFile();
  const now = new Date().toISOString();
  const mapping = {
    id: generateMappingId(),
    ...validation.value,
    createdAt: now,
    updatedAt: now,
  };

  data.mappings.push(mapping);
  writeMappingsFile(data);
  return { mapping: toPublicMapping(mapping) };
}

export function updateCustomerFieldUserMapping(mappingId, input) {
  const data = readMappingsFile();
  const index = (data.mappings ?? []).findIndex((row) => row.id === mappingId);
  if (index === -1) {
    return { errors: ['customerFieldUserNotFound'] };
  }

  const validation = validateMappingInput(input, { existingId: mappingId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.mappings[index],
    ...validation.value,
    updatedAt: new Date().toISOString(),
  };

  data.mappings[index] = updated;
  writeMappingsFile(data);
  return { mapping: toPublicMapping(updated) };
}

export function deleteCustomerFieldUserMapping(mappingId) {
  const data = readMappingsFile();
  const index = (data.mappings ?? []).findIndex((row) => row.id === mappingId);
  if (index === -1) {
    return { errors: ['customerFieldUserNotFound'] };
  }

  const [removed] = data.mappings.splice(index, 1);
  writeMappingsFile(data);
  return { mapping: toPublicMapping(removed) };
}

function findCustomerForImport(customerNameOrAlias) {
  const needle = normalizeCompare(customerNameOrAlias);
  if (!needle) return null;
  const customers = listCustomerRecords();
  const exact =
    customers.find((customer) => normalizeCompare(customer.name) === needle) ||
    customers.find((customer) => normalizeCompare(customer.alias) === needle);
  if (exact) return exact;
  if (needle.length < 6) return null;
  return (
    customers.find((customer) => {
      const name = normalizeCompare(customer.name);
      return name.startsWith(needle) || needle.startsWith(name);
    }) || null
  );
}

function headerKey(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

function isPresentImportValue(value) {
  if (value === undefined || value === null) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value).trim() !== '';
}

function normalizeImportRow(raw = {}) {
  const entries = Object.entries(raw ?? {});

  const get = (...keys) => {
    for (const key of keys) {
      if (isPresentImportValue(raw[key])) return raw[key];
    }
    for (const key of keys) {
      const needle = headerKey(key);
      const match = entries.find(([header]) => headerKey(header) === needle);
      if (match && isPresentImportValue(match[1])) return match[1];
    }
    return undefined;
  };

  const getValidityFrom = () => {
    const direct = get(
      'Validity From',
      'ValidityFrom',
      'Valid From',
      'ValidFrom',
      'validityFrom',
      'Validity Date',
      'Valid From Date',
      'Applicable Date From',
      'ApplicableDateFrom',
      'From Date',
      'Date From',
      'Date',
      'Ισχύς Από',
      'Ισχύει Από',
    );
    if (direct !== undefined) return direct;

    // Soft match: any header that looks like a validity/from date column.
    const soft = entries.find(([header, value]) => {
      if (!isPresentImportValue(value)) return false;
      const key = headerKey(header);
      return (
        key.includes('validityfrom') ||
        key.includes('validfrom') ||
        key.includes('applicabledatefrom') ||
        (key.includes('validity') && key.includes('date')) ||
        (key.includes('ισχυ') && key.includes('απο'))
      );
    });
    return soft?.[1];
  };

  return {
    customer: normalizeText(get('Customer', 'Customer Name', 'customer', 'customerName', 'Πελάτης')),
    fieldName: normalizeText(get('Field Name', 'FieldName', 'fieldName', 'Field', 'Όνομα Πεδίου')),
    fieldValue: normalizeText(get('Field Value', 'FieldValue', 'fieldValue', 'Value', 'Τιμή Πεδίου')),
    users: normalizeText(get('Users', 'User', 'users', 'User Alias', 'Aliases', 'Χρήστες')),
    validityFrom: getValidityFrom(),
  };
}

/**
 * Import mappings from Excel (ASTRAEA Customer Fields To Users export).
 * Matching key: customer + fieldValue + validityFrom.
 */
export function importCustomerFieldUserMappings(rows) {
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
    if (!row.customer && !row.fieldValue && !row.users) {
      summary.skipped += 1;
      return;
    }

    const customer = findCustomerForImport(row.customer);
    if (!customer) {
      summary.errors.push({
        row: rowNumber,
        message: 'customerFieldUserCustomerInvalid',
        detail: row.customer || '',
      });
      summary.skipped += 1;
      return;
    }

    const validityFrom = normalizeValidityFrom(row.validityFrom);
    if (!row.fieldValue) {
      summary.errors.push({ row: rowNumber, message: 'customerFieldUserFieldValueRequired' });
      summary.skipped += 1;
      return;
    }
    if (!validityFrom) {
      summary.errors.push({
        row: rowNumber,
        message: 'customerFieldUserValidityFromRequired',
        detail: normalizeText(row.validityFrom),
      });
      summary.skipped += 1;
      return;
    }

    const resolvedUsers = resolveUserIdsFromLabels(row.users);
    if (resolvedUsers.missing.length > 0 || resolvedUsers.userIds.length === 0) {
      summary.errors.push({
        row: rowNumber,
        message: 'customerFieldUserUsersInvalid',
        detail: resolvedUsers.missing.join(', ') || row.users,
      });
      summary.skipped += 1;
      return;
    }

    const payload = {
      customerId: customer.id,
      fieldName: row.fieldName || customer.field2Name || '',
      fieldValue: row.fieldValue,
      userIds: resolvedUsers.userIds,
      validityFrom,
    };

    const data = readMappingsFile();
    const existing = (data.mappings ?? []).find(
      (item) =>
        item.customerId === customer.id &&
        normalizeCompare(item.fieldValue) === normalizeCompare(row.fieldValue) &&
        item.validityFrom === validityFrom,
    );

    if (existing) {
      const result = updateCustomerFieldUserMapping(existing.id, payload);
      if (result.errors) {
        summary.errors.push({
          row: rowNumber,
          message: result.errors[0],
          detail: row.fieldValue,
        });
        summary.skipped += 1;
        return;
      }
      summary.updated += 1;
      return;
    }

    const result = createCustomerFieldUserMapping(payload);
    if (result.errors) {
      summary.errors.push({
        row: rowNumber,
        message: result.errors[0],
        detail: row.fieldValue,
      });
      summary.skipped += 1;
      return;
    }
    summary.created += 1;
  });

  return summary;
}
