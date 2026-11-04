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
import {
  customerHasAllocatedJobs,
  customerHasProjects,
} from './customerReferences.js';
import { customerFieldValueAssignedToProjects } from './customerFieldValueReferences.js';

const CUSTOMERS_PATH = path.join(DB_DIR, 'customers.json');
const CUSTOMER_FIELD_VALUES_PATH = path.join(DB_DIR, 'customerFieldValues.json');
const USERS_PATH = path.join(DB_DIR, 'users.json');

export const SLA_OPTIONS = [
  '1 day',
  '2 days',
  '3 days',
  '4 days',
  '5 days',
  '6 days',
  '7 days',
  '8 days',
  '9 days',
  '10 days',
];

export const TRAVELLING_CHARGES_OPTIONS = [
  'billable_by_table',
  'billable_by_km',
  'non_billable',
];

export const FIELD_STATUS_OPTIONS = ['invisible', 'visible_mandatory', 'visible_optional'];

export const DROPDOWN_FIELD_REFERENCES = [1, 2];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMARKS_MAX_LENGTH = 300;

const DEFAULT_CUSTOM_FIELDS = {
  field1Status: 'invisible',
  field1Name: '',
  field2Status: 'invisible',
  field2Name: '',
  field3Status: 'invisible',
  field3Name: '',
  field4Status: 'invisible',
  field4Name: '',
};

function readCustomersFile() {
  ensureCollectionFile('customers', { customers: [] });
  return readCollection('customers', { customers: [] });
}

function writeCustomersFile(data) {
  writeCollection('customers', data);
}

function readCustomerFieldValuesFile() {
  ensureCollectionFile('customerFieldValues', { values: [] });
  return readCollection('customerFieldValues', { values: [] });
}

function writeCustomerFieldValuesFile(data) {
  writeCollection('customerFieldValues', data);
}

function generateCustomerId() {
  return `cus-${crypto.randomUUID().slice(0, 8)}`;
}

function generateFieldValueId() {
  return `cfv-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeSla(value) {
  if (typeof value !== 'string') return SLA_OPTIONS[0];
  const normalized = value.trim().toLowerCase();
  const match = SLA_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match ?? SLA_OPTIONS[0];
}

function normalizeTravellingCharges(value) {
  if (typeof value !== 'string') return 'non_billable';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  const aliases = {
    billable_by_table: 'billable_by_table',
    'billable_by_table': 'billable_by_table',
    billable_by_km: 'billable_by_km',
    'billable_by_km': 'billable_by_km',
    non_billable: 'non_billable',
    'non-billable': 'non_billable',
  };
  return aliases[normalized] ?? 'non_billable';
}

function normalizeFieldStatus(value) {
  if (typeof value !== 'string') return 'invisible';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (FIELD_STATUS_OPTIONS.includes(normalized)) return normalized;
  if (normalized === 'visiblemandatory') return 'visible_mandatory';
  if (normalized === 'visibleoptional') return 'visible_optional';
  return 'invisible';
}

function normalizeHourlyRate(value) {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (Number.isNaN(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
}

function normalizeFieldReference(value) {
  const ref = Number(value);
  return ref === 1 || ref === 2 ? ref : null;
}

function nextCustomerNumber(customers) {
  let max = 0;
  for (const customer of customers) {
    const match = /^CU(\d+)$/i.exec(customer.customerNumber ?? '');
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `CU${String(max + 1).padStart(4, '0')}`;
}

function migrateCustomerRecord(customer, index, allCustomers) {
  const now = new Date().toISOString();
  let customerNumber = customer.customerNumber;
  if (!customerNumber) {
    customerNumber = `CU${String(index + 1).padStart(4, '0')}`;
    const taken = new Set(allCustomers.map((row) => row.customerNumber).filter(Boolean));
    while (taken.has(customerNumber)) {
      const num = Number.parseInt(customerNumber.slice(2), 10) + 1;
      customerNumber = `CU${String(num).padStart(4, '0')}`;
    }
  }

  return {
    id: customer.id ?? generateCustomerId(),
    customerNumber,
    name: customer.name ?? '',
    alias: customer.alias ?? '',
    contactPerson: customer.contactPerson ?? '',
    contactPhone: customer.contactPhone ?? '',
    contactEmail: customer.contactEmail ?? '',
    paymentTerms: customer.paymentTerms ?? '',
    priorityErpNumber: customer.priorityErpNumber ?? '',
    hourlyRate: normalizeHourlyRate(customer.hourlyRate ?? 0),
    sla: normalizeSla(customer.sla ?? SLA_OPTIONS[0]),
    travellingCharges: normalizeTravellingCharges(customer.travellingCharges ?? 'non_billable'),
    remarks: (customer.remarks ?? '').slice(0, REMARKS_MAX_LENGTH),
    isStenoCustomer: customer.isStenoCustomer === true,
    isAudioCustomer: customer.isAudioCustomer === true,
    isCaptionsCustomer: customer.isCaptionsCustomer === true,
    field1Status: normalizeFieldStatus(customer.field1Status ?? DEFAULT_CUSTOM_FIELDS.field1Status),
    field1Name: customer.field1Name ?? '',
    field2Status: normalizeFieldStatus(customer.field2Status ?? DEFAULT_CUSTOM_FIELDS.field2Status),
    field2Name: customer.field2Name ?? '',
    field3Status: normalizeFieldStatus(customer.field3Status ?? DEFAULT_CUSTOM_FIELDS.field3Status),
    field3Name: customer.field3Name ?? '',
    field4Status: normalizeFieldStatus(customer.field4Status ?? DEFAULT_CUSTOM_FIELDS.field4Status),
    field4Name: customer.field4Name ?? '',
    enabled: customer.enabled !== false,
    createdAt: customer.createdAt ?? now,
    updatedAt: customer.updatedAt ?? now,
  };
}

function seedCustomersIfEmpty() {
  const data = readCustomersFile();
  if ((data.customers ?? []).length > 0) {
    return;
  }
  const now = new Date().toISOString();
  writeCustomersFile({
    customers: [
      {
        id: 'cus-001',
        customerNumber: 'CU0001',
        name: 'Galatariotis Ltd',
        alias: 'GAL',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        paymentTerms: '',
        priorityErpNumber: '',
        hourlyRate: 0,
        sla: '1 day',
        travellingCharges: 'non_billable',
        remarks: '',
        isStenoCustomer: true,
        isAudioCustomer: false,
        isCaptionsCustomer: false,
        ...DEFAULT_CUSTOM_FIELDS,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cus-002',
        customerNumber: 'CU0002',
        name: 'Cyprus Courts',
        alias: 'CC',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        paymentTerms: '',
        priorityErpNumber: '',
        hourlyRate: 0,
        sla: '1 day',
        travellingCharges: 'non_billable',
        remarks: '',
        isStenoCustomer: true,
        isAudioCustomer: false,
        isCaptionsCustomer: false,
        ...DEFAULT_CUSTOM_FIELDS,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
}

export function migrateCustomers() {
  seedCustomersIfEmpty();
  const data = readCustomersFile();
  let changed = false;
  data.customers = (data.customers ?? []).map((customer, index) => {
    const migrated = migrateCustomerRecord(customer, index, data.customers);
    if (JSON.stringify(migrated) !== JSON.stringify(customer)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeCustomersFile(data);
  }
  return data;
}

export function ensureCustomersDatabase() {
  ensureCollectionFile('customers', { customers: [] });
  ensureCollectionFile('customerFieldValues', { values: [] });
  migrateCustomers();
}

function listFieldValuesForCustomer(customerId) {
  const data = readCustomerFieldValuesFile();
  return (data.values ?? [])
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => {
      if (a.fieldReference !== b.fieldReference) {
        return a.fieldReference - b.fieldReference;
      }
      return (a.order ?? 0) - (b.order ?? 0);
    });
}

export function toPublicCustomer(customer, includeFieldValues = false) {
  const base = {
    id: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    alias: customer.alias,
    contactPerson: customer.contactPerson,
    contactPhone: customer.contactPhone,
    contactEmail: customer.contactEmail,
    paymentTerms: customer.paymentTerms ?? '',
    priorityErpNumber: customer.priorityErpNumber,
    hourlyRate: customer.hourlyRate,
    sla: customer.sla,
    travellingCharges: customer.travellingCharges,
    remarks: customer.remarks,
    isStenoCustomer: customer.isStenoCustomer === true,
    isAudioCustomer: customer.isAudioCustomer === true,
    isCaptionsCustomer: customer.isCaptionsCustomer === true,
    field1Status: customer.field1Status,
    field1Name: customer.field1Name,
    field2Status: customer.field2Status,
    field2Name: customer.field2Name,
    field3Status: customer.field3Status,
    field3Name: customer.field3Name,
    field4Status: customer.field4Status,
    field4Name: customer.field4Name,
    enabled: customer.enabled !== false,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };

  if (!includeFieldValues) {
    return base;
  }

  const fieldValues = listFieldValuesForCustomer(customer.id);
  return {
    ...base,
    fieldValues,
  };
}

export function listCustomers() {
  const data = readCustomersFile();
  return (data.customers ?? [])
    .filter((customer) => customer.enabled !== false)
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      alias: customer.alias,
    }));
}

export function listCustomerRecords() {
  const data = readCustomersFile();
  return (data.customers ?? [])
    .map((customer) => toPublicCustomer(customer))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function findCustomerById(customerId) {
  if (!customerId) return null;
  const data = readCustomersFile();
  const customer = data.customers.find((row) => row.id === customerId) ?? null;
  if (!customer) return null;
  return customer;
}

export function findCustomerRecordById(customerId) {
  const customer = findCustomerById(customerId);
  if (!customer) return null;
  return toPublicCustomer(customer, true);
}

function validateCustomerInput(input, { existingId = null } = {}) {
  const errors = [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const alias = typeof input.alias === 'string' ? input.alias.trim() : '';
  const contactPerson =
    typeof input.contactPerson === 'string' ? input.contactPerson.trim() : '';
  const contactPhone = typeof input.contactPhone === 'string' ? input.contactPhone.trim() : '';
  const contactEmail = typeof input.contactEmail === 'string' ? input.contactEmail.trim() : '';
  const paymentTerms =
    typeof input.paymentTerms === 'string' ? input.paymentTerms.trim() : '';
  const priorityErpNumber =
    typeof input.priorityErpNumber === 'string' ? input.priorityErpNumber.trim() : '';
  const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : '';
  const field1Name = typeof input.field1Name === 'string' ? input.field1Name.trim() : '';
  const field2Name = typeof input.field2Name === 'string' ? input.field2Name.trim() : '';
  const field3Name = typeof input.field3Name === 'string' ? input.field3Name.trim() : '';
  const field4Name = typeof input.field4Name === 'string' ? input.field4Name.trim() : '';

  if (!name) errors.push('customerNameRequired');
  if (!alias) errors.push('customerAliasRequired');
  const hourlyRateMissing =
    input.hourlyRate === '' ||
    input.hourlyRate === null ||
    input.hourlyRate === undefined ||
    (typeof input.hourlyRate === 'string' && !input.hourlyRate.trim());
  // Import rows may omit hourly rate / SLA; default them instead of failing the whole file.
  if (!input.__importRelaxed) {
    if (hourlyRateMissing) errors.push('customerHourlyRateRequired');
    if (!input.sla || (typeof input.sla === 'string' && !input.sla.trim())) {
      errors.push('customerSlaRequired');
    }
  }
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) errors.push('emailInvalid');
  if (remarks.length > REMARKS_MAX_LENGTH) errors.push('customerRemarksTooLong');

  const data = readCustomersFile();
  const aliasOwner = data.customers.find(
    (row) => row.alias.toLowerCase() === alias.toLowerCase() && row.id !== existingId,
  );
  if (alias && aliasOwner) errors.push('customerAliasTaken');

  const value = {
    name,
    alias,
    contactPerson,
    contactPhone,
    contactEmail,
    paymentTerms,
    priorityErpNumber,
    hourlyRate: hourlyRateMissing ? 0 : normalizeHourlyRate(input.hourlyRate),
    sla: normalizeSla(input.sla || SLA_OPTIONS[0]),
    travellingCharges: normalizeTravellingCharges(input.travellingCharges),
    remarks: remarks.slice(0, REMARKS_MAX_LENGTH),
    isStenoCustomer: normalizeBooleanFlag(input.isStenoCustomer, true),
    isAudioCustomer: normalizeBooleanFlag(input.isAudioCustomer, false),
    isCaptionsCustomer: normalizeBooleanFlag(input.isCaptionsCustomer, false),
    field1Status: normalizeFieldStatus(input.field1Status),
    field1Name,
    field2Status: normalizeFieldStatus(input.field2Status),
    field2Name,
    field3Status: normalizeFieldStatus(input.field3Status),
    field3Name,
    field4Status: normalizeFieldStatus(input.field4Status),
    field4Name,
    enabled: normalizeEnabledFlag(input),
  };

  return { errors, value };
}

function normalizeBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'x', '✓', '✔', 'enabled', 'active'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'disabled', 'inactive'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function normalizeEnabledFlag(input) {
  if (input.enabled !== undefined && input.enabled !== null && input.enabled !== '') {
    return normalizeBooleanFlag(input.enabled, true);
  }
  if (typeof input.status === 'string' && input.status.trim()) {
    const status = input.status.trim().toLowerCase();
    if (['disabled', 'inactive', 'off', 'no'].includes(status)) return false;
    if (['enabled', 'active', 'on', 'yes'].includes(status)) return true;
  }
  return input.enabled !== false;
}

function validateFieldValueInput(input, customerId) {
  const errors = [];
  const fieldReference = normalizeFieldReference(input.fieldReference);
  const value = typeof input.value === 'string' ? input.value.trim() : '';
  const order = Number.isFinite(Number(input.order)) ? Number(input.order) : 0;

  if (!findCustomerById(customerId)) errors.push('customerNotFound');
  if (!fieldReference) errors.push('customerFieldNameRequired');
  if (!value) errors.push('customerFieldValueRequired');

  return {
    errors,
    value: {
      fieldReference,
      value,
      order,
    },
  };
}

export function createCustomer(input) {
  const { errors, value } = validateCustomerInput(input);
  if (errors.length > 0) {
    return { errors };
  }

  const data = readCustomersFile();
  const now = new Date().toISOString();
  const customer = {
    id: generateCustomerId(),
    customerNumber: nextCustomerNumber(data.customers),
    ...value,
    createdAt: now,
    updatedAt: now,
  };

  data.customers.push(customer);
  writeCustomersFile(data);
  return { customer: toPublicCustomer(customer, true) };
}

export function updateCustomer(customerId, input) {
  const data = readCustomersFile();
  const index = data.customers.findIndex((row) => row.id === customerId);
  if (index === -1) {
    return { errors: ['customerNotFound'] };
  }

  const { errors, value } = validateCustomerInput(input, { existingId: customerId });
  if (errors.length > 0) {
    return { errors };
  }

  const updated = {
    ...data.customers[index],
    ...value,
    updatedAt: new Date().toISOString(),
  };

  data.customers[index] = updated;
  writeCustomersFile(data);
  return { customer: toPublicCustomer(updated, true) };
}

export function listCustomerFieldValues(customerId, fieldReference = null) {
  if (!findCustomerById(customerId)) {
    return { errors: ['customerNotFound'] };
  }

  let values = listFieldValuesForCustomer(customerId);
  if (fieldReference !== null) {
    const ref = normalizeFieldReference(fieldReference);
    if (!ref) {
      return { errors: ['customerFieldReferenceInvalid'] };
    }
    values = values.filter((entry) => entry.fieldReference === ref);
  }

  return { values };
}

export function createCustomerFieldValue(customerId, input) {
  const { errors, value } = validateFieldValueInput(input, customerId);
  if (errors.length > 0) {
    return { errors };
  }

  const data = readCustomerFieldValuesFile();
  const existingForField = (data.values ?? []).filter(
    (entry) => entry.customerId === customerId && entry.fieldReference === value.fieldReference,
  );
  const nextOrder =
    value.order > 0
      ? value.order
      : existingForField.reduce((max, entry) => Math.max(max, entry.order ?? 0), 0) + 1;

  const entry = {
    id: generateFieldValueId(),
    customerId,
    fieldReference: value.fieldReference,
    value: value.value,
    order: nextOrder,
  };

  data.values.push(entry);
  writeCustomerFieldValuesFile(data);
  return { fieldValue: entry };
}

export function updateCustomerFieldValue(customerId, fieldValueId, input) {
  if (!findCustomerById(customerId)) {
    return { errors: ['customerNotFound'] };
  }

  const data = readCustomerFieldValuesFile();
  const index = data.values.findIndex(
    (row) => row.id === fieldValueId && row.customerId === customerId,
  );
  if (index === -1) {
    return { errors: ['customerFieldValueNotFound'] };
  }

  const { errors, value } = validateFieldValueInput(input, customerId);
  if (errors.length > 0) {
    return { errors };
  }

  data.values[index] = {
    ...data.values[index],
    fieldReference: value.fieldReference,
    value: value.value,
    order: value.order,
  };
  writeCustomerFieldValuesFile(data);
  return { fieldValue: data.values[index] };
}

export function deleteCustomerFieldValue(customerId, fieldValueId) {
  const data = readCustomerFieldValuesFile();
  const index = data.values.findIndex(
    (row) => row.id === fieldValueId && row.customerId === customerId,
  );
  if (index === -1) {
    return { errors: ['customerFieldValueNotFound'] };
  }

  if (customerFieldValueAssignedToProjects(fieldValueId)) {
    return { errors: ['customerFieldValueHasProjects'] };
  }

  const [removed] = data.values.splice(index, 1);
  writeCustomerFieldValuesFile(data);
  return { fieldValue: removed };
}

export function replaceCustomerFieldValues(customerId, fieldReference, items) {
  if (!findCustomerById(customerId)) {
    return { errors: ['customerNotFound'] };
  }

  const ref = normalizeFieldReference(fieldReference);
  if (!ref) {
    return { errors: ['customerFieldReferenceInvalid'] };
  }

  const data = readCustomerFieldValuesFile();
  data.values = (data.values ?? []).filter(
    (entry) => !(entry.customerId === customerId && entry.fieldReference === ref),
  );

  const normalizedItems = Array.isArray(items) ? items : [];
  normalizedItems.forEach((item, index) => {
    const value = typeof item.value === 'string' ? item.value.trim() : '';
    if (!value) return;
    const order = Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1;
    data.values.push({
      id: generateFieldValueId(),
      customerId,
      fieldReference: ref,
      value,
      order,
    });
  });

  writeCustomerFieldValuesFile(data);
  return { values: listFieldValuesForCustomer(customerId).filter((row) => row.fieldReference === ref) };
}

function removeFieldValuesForCustomer(customerId) {
  const data = readCustomerFieldValuesFile();
  data.values = (data.values ?? []).filter((entry) => entry.customerId !== customerId);
  writeCustomerFieldValuesFile(data);
}

function countUsersByCustomerId(customerId) {
  const data = readCollection('users', { users: [] });
  return (data.users ?? []).filter((user) => user.customerId === customerId).length;
}

export function deleteCustomer(customerId) {
  if (!findCustomerById(customerId)) {
    return { errors: ['customerNotFound'] };
  }

  if (customerHasAllocatedJobs(customerId)) {
    return { errors: ['customerHasJobs'] };
  }

  if (customerHasProjects(customerId)) {
    return { errors: ['customerHasProjects'] };
  }

  if (countUsersByCustomerId(customerId) > 0) {
    return { errors: ['customerHasUsers'] };
  }

  const data = readCustomersFile();
  const index = data.customers.findIndex((row) => row.id === customerId);
  if (index === -1) {
    return { errors: ['customerNotFound'] };
  }

  const [removed] = data.customers.splice(index, 1);
  writeCustomersFile(data);
  removeFieldValuesForCustomer(customerId);
  return { customer: toPublicCustomer(removed) };
}

export function updateCustomerStatus(customerId, enabled) {
  const data = readCustomersFile();
  const index = data.customers.findIndex((row) => row.id === customerId);
  if (index === -1) {
    return { errors: ['customerNotFound'] };
  }

  data.customers[index] = {
    ...data.customers[index],
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  };
  writeCustomersFile(data);
  return { customer: toPublicCustomer(data.customers[index]) };
}

/**
 * Import customers from parsed Excel/CSV rows (usually from the old ASTRAEA export).
 * Matching key: alias (case-insensitive). Creates new rows or updates existing ones.
 */
export function importCustomers(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  list.forEach((rawRow, index) => {
    const rowNumber = index + 2; // header is row 1 in Excel
    const row = normalizeImportRow(rawRow);
    if (!row.name && !row.alias) {
      summary.skipped += 1;
      return;
    }
    if (!row.name || !row.alias) {
      summary.errors.push({
        row: rowNumber,
        message: !row.name ? 'customerNameRequired' : 'customerAliasRequired',
      });
      summary.skipped += 1;
      return;
    }

    const data = readCustomersFile();
    const existing = data.customers.find(
      (customer) => customer.alias.toLowerCase() === row.alias.toLowerCase(),
    );

    if (existing) {
      const result = updateCustomer(existing.id, {
        ...row,
        __importRelaxed: true,
        // Preserve fields not present in the import row.
        field1Status: existing.field1Status,
        field1Name: existing.field1Name,
        field2Status: existing.field2Status,
        field2Name: existing.field2Name,
        field3Status: existing.field3Status,
        field3Name: existing.field3Name,
        field4Status: existing.field4Status,
        field4Name: existing.field4Name,
        hourlyRate: row.hourlyRate ?? existing.hourlyRate,
        sla: row.sla || existing.sla,
        travellingCharges: row.travellingCharges || existing.travellingCharges,
      });
      if (result.errors) {
        summary.errors.push({ row: rowNumber, message: result.errors[0] });
        summary.skipped += 1;
        return;
      }
      summary.updated += 1;
      return;
    }

    const result = createCustomer({
      ...row,
      __importRelaxed: true,
    });
    if (result.errors) {
      summary.errors.push({ row: rowNumber, message: result.errors[0] });
      summary.skipped += 1;
      return;
    }
    summary.created += 1;
  });

  return summary;
}

function normalizeImportRow(raw = {}) {
  const get = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
        return raw[key];
      }
    }
    // Case-insensitive / spaced header fallback
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

  const text = (...keys) => String(get(...keys) ?? '').trim();

  return {
    name: text('name', 'Name', 'Customer Name', 'CustomerName'),
    alias: text('alias', 'Alias'),
    contactPerson: text('contactPerson', 'Contact Person', 'ContactPerson'),
    contactPhone: text('contactPhone', 'Contact Phone', 'ContactPhone'),
    contactEmail: text('contactEmail', 'Contact Email', 'ContactEmail', 'Email'),
    paymentTerms: text('paymentTerms', 'Payment Terms', 'PaymentTerms'),
    priorityErpNumber: text(
      'priorityErpNumber',
      'Number In Priority ERP',
      'Number in Priority ERP',
      'Priority ERP',
      'PriorityERP',
    ),
    hourlyRate: get('hourlyRate', 'Hourly Rate', 'HourlyRate'),
    sla: get('sla', 'SLA', 'Service Level Agreement'),
    travellingCharges: get('travellingCharges', 'Travelling Charges'),
    remarks: text('remarks', 'Remarks'),
    isStenoCustomer: get('isStenoCustomer', 'Steno Customer', 'StenoCustomer', 'Steno'),
    isAudioCustomer: get('isAudioCustomer', 'Audio Customer', 'AudioCustomer', 'Audio'),
    isCaptionsCustomer: get(
      'isCaptionsCustomer',
      'Captions Customer',
      'CaptionsCustomer',
      'Caption Customer',
      'Captions',
    ),
    enabled: get('enabled', 'Enabled'),
    status: get('status', 'Status'),
  };
}
