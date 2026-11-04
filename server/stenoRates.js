import crypto from 'node:crypto';
import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import { findCustomerById, listCustomerRecords } from './customers.js';

function readStenoRatesFile() {
  ensureCollectionFile('stenoRates', { rates: [] });
  return readCollection('stenoRates', { rates: [] });
}

function writeStenoRatesFile(data) {
  writeCollection('stenoRates', data);
}

function generateStenoRateId() {
  return `sr-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeMatchKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric * 100) / 100;
}

function normalizeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number.parseInt(String(value), 10);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

function excelSerialToIso(serial) {
  const numeric = Number(serial);
  if (!Number.isFinite(numeric) || numeric < 20000 || numeric > 80000) return '';
  // Excel's day 0 is 1899-12-30 (accounts for the 1900 leap-year bug).
  const utcDays = Math.floor(numeric);
  const date = new Date(Date.UTC(1899, 11, 30) + utcDays * 86400000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function expandTwoDigitYear(yearText) {
  const year = Number.parseInt(yearText, 10);
  if (!Number.isFinite(year)) return '';
  if (yearText.length === 4) return String(year);
  // Pivot: 00-69 → 2000-2069, 70-99 → 1970-1999
  return String(year >= 70 ? 1900 + year : 2000 + year);
}

function normalizeValidityFrom(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromSerial = excelSerialToIso(value);
    if (fromSerial) return fromSerial;
  }

  const text = normalizeText(value);
  if (!text) return '';

  // Excel serial stored as plain number/text
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const fromSerial = excelSerialToIso(text);
    if (fromSerial) return fromSerial;
  }

  // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (+ optional time), prefer EU day-first
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s|$|T)/.exec(`${text} `);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = expandTwoDigitYear(dmy[3]);
    if (year && Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return '';
}

function normalizeTime(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function findCustomerByNameOrAlias(value) {
  const needle = normalizeMatchKey(value);
  if (!needle) return null;
  const customers = listCustomerRecords();
  const exact =
    customers.find((customer) => {
      const alias = normalizeMatchKey(customer.alias);
      const name = normalizeMatchKey(customer.name);
      return alias === needle || name === needle;
    }) ?? null;
  if (exact) return exact;

  // Fallback: Excel name contains alias (or vice versa) for short aliases (3+ chars)
  return (
    customers.find((customer) => {
      const alias = normalizeMatchKey(customer.alias);
      if (alias.length < 3) return false;
      return needle === alias || needle.includes(alias) || alias.includes(needle);
    }) ?? null
  );
}

function migrateStenoRateRecord(rate) {
  const now = new Date().toISOString();
  return {
    id: rate.id ?? generateStenoRateId(),
    customerId: normalizeText(rate.customerId),
    hourlyRate: normalizeNumber(rate.hourlyRate),
    hourlyRateExpedited: normalizeNumber(rate.hourlyRateExpedited),
    hourlyRateOutsideWorkingHrs: normalizeNumber(rate.hourlyRateOutsideWorkingHrs),
    hourlyRateOutsideWorkingHrsExpedited: normalizeNumber(
      rate.hourlyRateOutsideWorkingHrsExpedited,
    ),
    firstDiscountPercentage: normalizeNumber(rate.firstDiscountPercentage),
    nrExemptedStenotypists: normalizeInteger(rate.nrExemptedStenotypists),
    secondDiscountPercentage: normalizeNumber(rate.secondDiscountPercentage),
    secondStenotypistDiscountThreshold: normalizeInteger(rate.secondStenotypistDiscountThreshold),
    travelByKmAmount: normalizeNumber(rate.travelByKmAmount),
    sla: normalizeText(rate.sla) || '1 day',
    slaExpedited: normalizeText(rate.slaExpedited) || '',
    workingHoursStart: normalizeTime(rate.workingHoursStart),
    workingHoursEnd: normalizeTime(rate.workingHoursEnd),
    validityFrom: normalizeValidityFrom(rate.validityFrom),
    createdAt: rate.createdAt ?? now,
    updatedAt: rate.updatedAt ?? now,
  };
}

export function ensureStenoRatesDatabase() {
  ensureCollectionFile('stenoRates', { rates: [] });
  const data = readStenoRatesFile();
  let changed = false;
  data.rates = (data.rates ?? []).map((rate) => {
    const migrated = migrateStenoRateRecord(rate);
    if (JSON.stringify(migrated) !== JSON.stringify(rate)) changed = true;
    return migrated;
  });
  if (changed) writeStenoRatesFile(data);
}

function toPublicStenoRate(rate) {
  const customer = findCustomerById(rate.customerId);
  return {
    id: rate.id,
    customerId: rate.customerId,
    customerName: customer?.name ?? '',
    customerAlias: customer?.alias ?? '',
    hourlyRate: rate.hourlyRate,
    hourlyRateExpedited: rate.hourlyRateExpedited,
    hourlyRateOutsideWorkingHrs: rate.hourlyRateOutsideWorkingHrs,
    hourlyRateOutsideWorkingHrsExpedited: rate.hourlyRateOutsideWorkingHrsExpedited,
    firstDiscountPercentage: rate.firstDiscountPercentage,
    nrExemptedStenotypists: rate.nrExemptedStenotypists,
    secondDiscountPercentage: rate.secondDiscountPercentage,
    secondStenotypistDiscountThreshold: rate.secondStenotypistDiscountThreshold,
    travelByKmAmount: rate.travelByKmAmount,
    sla: rate.sla,
    slaExpedited: rate.slaExpedited,
    workingHoursStart: rate.workingHoursStart,
    workingHoursEnd: rate.workingHoursEnd,
    validityFrom: rate.validityFrom,
    createdAt: rate.createdAt,
    updatedAt: rate.updatedAt,
  };
}

function isStenoRateApplicableInRange(entry, groupEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validityFrom > rangeTo) return false;

  const sorted = [...groupEntries].sort((a, b) => a.validityFrom.localeCompare(b.validityFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextFrom =
    index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validityFrom : null;
  const appliesUntil = nextFrom ? previousDay(nextFrom) : '9999-12-31';
  return appliesUntil >= rangeFrom;
}

function previousDay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function listStenoRateRecords({
  customerId = '',
  dateFrom = '',
  dateTo = '',
  search = '',
} = {}) {
  ensureStenoRatesDatabase();
  const data = readStenoRatesFile();
  const customerFilter = normalizeText(customerId);
  const fromKey = normalizeValidityFrom(dateFrom);
  const toKey = normalizeValidityFrom(dateTo);
  const query = normalizeText(search).toLowerCase();

  let rows = (data.rates ?? []).map((rate) => toPublicStenoRate(rate));

  if (customerFilter) {
    rows = rows.filter((rate) => rate.customerId === customerFilter);
  }

  if (fromKey || toKey) {
    const groups = new Map();
    for (const row of rows) {
      const list = groups.get(row.customerId) ?? [];
      list.push(row);
      groups.set(row.customerId, list);
    }
    rows = rows.filter((row) =>
      isStenoRateApplicableInRange(row, groups.get(row.customerId) ?? [row], fromKey, toKey),
    );
  }

  if (query) {
    rows = rows.filter((rate) => {
      const haystack = `${rate.customerName} ${rate.customerAlias}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  return rows.sort((a, b) => {
    const byCustomer = a.customerName.localeCompare(b.customerName, undefined, {
      sensitivity: 'base',
    });
    if (byCustomer !== 0) return byCustomer;
    return String(a.validityFrom).localeCompare(String(b.validityFrom));
  });
}

export function findStenoRateById(id) {
  ensureStenoRatesDatabase();
  const data = readStenoRatesFile();
  const rate = (data.rates ?? []).find((row) => row.id === id);
  return rate ? toPublicStenoRate(rate) : null;
}

function validateStenoRateInput(input, { existingId = null } = {}) {
  const errors = [];
  let customerId = normalizeText(input.customerId);
  if (!customerId && input.customer) {
    const matched = findCustomerByNameOrAlias(input.customer);
    customerId = matched?.id ?? '';
  }
  if (!customerId) errors.push('stenoRateCustomerRequired');
  else if (!findCustomerById(customerId)) errors.push('stenoRateCustomerInvalid');

  const validityFrom = normalizeValidityFrom(input.validityFrom);
  if (!validityFrom) errors.push('stenoRateValidityFromRequired');

  const value = {
    customerId,
    hourlyRate: normalizeNumber(input.hourlyRate),
    hourlyRateExpedited: normalizeNumber(input.hourlyRateExpedited),
    hourlyRateOutsideWorkingHrs: normalizeNumber(input.hourlyRateOutsideWorkingHrs),
    hourlyRateOutsideWorkingHrsExpedited: normalizeNumber(
      input.hourlyRateOutsideWorkingHrsExpedited,
    ),
    firstDiscountPercentage: normalizeNumber(input.firstDiscountPercentage),
    nrExemptedStenotypists: normalizeInteger(input.nrExemptedStenotypists),
    secondDiscountPercentage: normalizeNumber(input.secondDiscountPercentage),
    secondStenotypistDiscountThreshold: normalizeInteger(input.secondStenotypistDiscountThreshold),
    travelByKmAmount: normalizeNumber(input.travelByKmAmount),
    sla: normalizeText(input.sla) || '1 day',
    slaExpedited: normalizeText(input.slaExpedited),
    workingHoursStart: normalizeTime(input.workingHoursStart),
    workingHoursEnd: normalizeTime(input.workingHoursEnd),
    validityFrom,
  };

  if (!errors.length) {
    const data = readStenoRatesFile();
    const duplicate = (data.rates ?? []).find(
      (row) =>
        row.id !== existingId &&
        row.customerId === value.customerId &&
        row.validityFrom === value.validityFrom,
    );
    if (duplicate) errors.push('stenoRateValidityFromDuplicate');
  }

  return { errors, value };
}

export function createStenoRate(input) {
  ensureStenoRatesDatabase();
  const { errors, value } = validateStenoRateInput(input);
  if (errors.length) return { errors };

  const data = readStenoRatesFile();
  const now = new Date().toISOString();
  const rate = {
    id: generateStenoRateId(),
    ...value,
    createdAt: now,
    updatedAt: now,
  };
  data.rates.push(rate);
  writeStenoRatesFile(data);
  return { rate: toPublicStenoRate(rate) };
}

export function updateStenoRate(id, input) {
  ensureStenoRatesDatabase();
  const data = readStenoRatesFile();
  const index = (data.rates ?? []).findIndex((row) => row.id === id);
  if (index === -1) return { errors: ['stenoRateNotFound'] };

  const { errors, value } = validateStenoRateInput(input, { existingId: id });
  if (errors.length) return { errors };

  data.rates[index] = {
    ...data.rates[index],
    ...value,
    updatedAt: new Date().toISOString(),
  };
  writeStenoRatesFile(data);
  return { rate: toPublicStenoRate(data.rates[index]) };
}

export function deleteStenoRate(id) {
  ensureStenoRatesDatabase();
  const data = readStenoRatesFile();
  const index = (data.rates ?? []).findIndex((row) => row.id === id);
  if (index === -1) return { errors: ['stenoRateNotFound'] };
  const [removed] = data.rates.splice(index, 1);
  writeStenoRatesFile(data);
  return { rate: toPublicStenoRate(removed) };
}

function normalizeHeaderKey(header) {
  return String(header ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_/&()-]+/g, '');
}

function getImportField(raw, ...keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      return raw[key];
    }
  }
  const entries = Object.entries(raw ?? {});
  for (const key of keys) {
    const needle = normalizeHeaderKey(key);
    const match = entries.find(([header]) => normalizeHeaderKey(header) === needle);
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') {
      return match[1];
    }
  }
  return undefined;
}

function normalizeImportRow(raw = {}) {
  const workingHoursCombined = getImportField(
    raw,
    'Working Hours Start / End',
    'Working Hours Start/End',
  );
  let workingHoursStart = getImportField(raw, 'Working Hours Start', 'workingHoursStart');
  let workingHoursEnd = getImportField(raw, 'Working Hours End', 'workingHoursEnd');
  if ((!workingHoursStart || !workingHoursEnd) && workingHoursCombined) {
    const parts = String(workingHoursCombined).split(/[-–/]/).map((part) => part.trim());
    if (parts.length >= 2) {
      workingHoursStart = workingHoursStart || parts[0];
      workingHoursEnd = workingHoursEnd || parts[1];
    }
  }

  return {
    customer: getImportField(
      raw,
      'Customer',
      'Customer Name',
      'CustomerName',
      'Name',
      'Alias',
      'customer',
      'Πελάτης',
    ),
    customerId: getImportField(raw, 'customerId', 'Customer Id'),
    hourlyRate: getImportField(raw, 'Hourly Rate', 'hourlyRate'),
    hourlyRateExpedited: getImportField(
      raw,
      'Hourly Rate (Expedited)',
      'Hourly Rate Expedited',
      'hourlyRateExpedited',
    ),
    hourlyRateOutsideWorkingHrs: getImportField(
      raw,
      'Hourly Rate (Outside Working Hrs)',
      'Hourly Rate Outside Working Hrs',
      'hourlyRateOutsideWorkingHrs',
    ),
    hourlyRateOutsideWorkingHrsExpedited: getImportField(
      raw,
      'Hourly Rate (Outside Working Hrs & Expedited)',
      'Hourly Rate Outside Working Hrs Expedited',
      'hourlyRateOutsideWorkingHrsExpedited',
    ),
    firstDiscountPercentage: getImportField(
      raw,
      '1st Discount Percentage',
      'First Discount Percentage',
      'firstDiscountPercentage',
    ),
    nrExemptedStenotypists: getImportField(
      raw,
      'Nr Of Exempted Stenotypists',
      'Number Of Exempted Stenotypists',
      'nrExemptedStenotypists',
    ),
    secondDiscountPercentage: getImportField(
      raw,
      '2nd Discount Percentage',
      'Second Discount Percentage',
      'secondDiscountPercentage',
    ),
    secondStenotypistDiscountThreshold: getImportField(
      raw,
      '2nd Stenotypist Discount Threshold',
      'Second Stenotypist Discount Threshold',
      'secondStenotypistDiscountThreshold',
    ),
    travelByKmAmount: getImportField(raw, 'Travel by Km Amount', 'Travel By Km Amount', 'travelByKmAmount'),
    sla: getImportField(raw, 'SLA', 'sla'),
    slaExpedited: getImportField(raw, 'SLA (Expedited)', 'SLA Expedited', 'slaExpedited'),
    workingHoursStart,
    workingHoursEnd,
    validityFrom: getImportField(
      raw,
      'Validity From',
      'Valid From',
      'ValidityFrom',
      'ValidFrom',
      'validityFrom',
      'Ισχύς Από',
      'Ισχύει Από',
    ),
  };
}

/**
 * Import steno rates from Excel rows.
 * Match key: customer (name/alias) + validityFrom.
 */
export function importStenoRates(rows) {
  ensureStenoRatesDatabase();
  const list = Array.isArray(rows) ? rows : [];
  const summary = { created: 0, updated: 0, skipped: 0, errors: [] };

  list.forEach((raw, index) => {
    const rowNumber = index + 2;
    const row = normalizeImportRow(raw);
    if (!row.customer && !row.customerId && !row.validityFrom) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: 'stenoRateImportRowEmpty' });
      return;
    }

    const matchedCustomer =
      (row.customerId && findCustomerById(row.customerId)) ||
      findCustomerByNameOrAlias(row.customer);
    if (!matchedCustomer) {
      summary.errors.push({
        row: rowNumber,
        message: 'stenoRateCustomerInvalid',
        detail: normalizeText(row.customer) || normalizeText(row.customerId),
      });
      summary.skipped += 1;
      return;
    }

    const validityFrom = normalizeValidityFrom(row.validityFrom);
    if (!validityFrom) {
      summary.errors.push({
        row: rowNumber,
        message: 'stenoRateValidityFromRequired',
        detail: normalizeText(row.validityFrom),
      });
      summary.skipped += 1;
      return;
    }

    const payload = {
      ...row,
      customerId: matchedCustomer.id,
      validityFrom,
    };

    const data = readStenoRatesFile();
    const existing = (data.rates ?? []).find(
      (rate) => rate.customerId === matchedCustomer.id && rate.validityFrom === validityFrom,
    );

    if (existing) {
      const result = updateStenoRate(existing.id, payload);
      if (result.errors) {
        summary.errors.push({ row: rowNumber, message: result.errors[0] });
        summary.skipped += 1;
        return;
      }
      summary.updated += 1;
      return;
    }

    const result = createStenoRate(payload);
    if (result.errors) {
      summary.errors.push({ row: rowNumber, message: result.errors[0] });
      summary.skipped += 1;
      return;
    }
    summary.created += 1;
  });

  return summary;
}
