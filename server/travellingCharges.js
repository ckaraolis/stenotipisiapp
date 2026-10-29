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
import { findCustomerById } from './customers.js';
import { findDistrictById } from './districts.js';
import { findProjectRecordById } from './projects.js';
import { listJobRecords } from './jobs.js';
import { normalizeValidityFrom } from './travellingTimes.js';

const TRAVELLING_CHARGES_PATH = path.join(DB_DIR, 'travellingCharges.json');

function readTravellingChargesFile() {
  ensureCollectionFile('travellingCharges', { charges: [] });
  return readCollection('travellingCharges', { charges: [] });
}

function writeTravellingChargesFile(data) {
  writeCollection('travellingCharges', data);
}

function generateTravellingChargeId() {
  return `tc-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeTravellingChargeAmount(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

function normalizeCustomerId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDistrictId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEnabledDistrict(districtId) {
  const district = findDistrictById(districtId);
  return Boolean(district && district.enabled !== false);
}

function migrateTravellingChargeRecord(charge) {
  const now = new Date().toISOString();
  return {
    id: charge.id ?? generateTravellingChargeId(),
    customerId: normalizeCustomerId(charge.customerId),
    districtId: normalizeDistrictId(charge.districtId),
    amount: normalizeTravellingChargeAmount(charge.amount) ?? 0,
    validityFrom: normalizeValidityFrom(charge.validityFrom),
    createdAt: charge.createdAt ?? now,
    updatedAt: charge.updatedAt ?? now,
  };
}

export function ensureTravellingChargesDatabase() {
  ensureCollectionFile('travellingCharges', { charges: [] });
}

function toPublicCustomer(customerId) {
  const customer = findCustomerById(customerId);
  return {
    id: customer?.id ?? customerId,
    name: customer?.name ?? '',
    alias: customer?.alias ?? '',
  };
}

function toPublicDistrict(districtId) {
  const district = findDistrictById(districtId);
  return {
    id: district?.id ?? districtId,
    name: district?.name ?? '',
    alias: district?.alias ?? '',
  };
}

function toPublicTravellingCharge(charge) {
  const customer = toPublicCustomer(charge.customerId);
  const district = toPublicDistrict(charge.districtId);
  return {
    id: charge.id,
    customerId: charge.customerId,
    customerName: customer.name,
    customerAlias: customer.alias,
    districtId: charge.districtId,
    districtName: district.name,
    districtAlias: district.alias,
    amount: charge.amount,
    validityFrom: charge.validityFrom,
    createdAt: charge.createdAt,
    updatedAt: charge.updatedAt,
  };
}

/**
 * §1.1 — Pick the charge entry valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 * The earliest entry applies to all earlier dates; the latest to all future dates.
 */
export function resolveTravellingChargeEntryForDate(entries, jobDate) {
  const dateKey = normalizeValidityFrom(jobDate);
  if (!dateKey || !Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const sorted = [...entries].sort((a, b) => a.validityFrom.localeCompare(b.validityFrom));
  const earliest = sorted[0];
  if (dateKey < earliest.validityFrom) {
    return earliest;
  }

  let selected = earliest;
  for (const entry of sorted) {
    if (entry.validityFrom <= dateKey) {
      selected = entry;
    } else {
      break;
    }
  }
  return selected;
}

/** §1.1 — Resolve the applicable travelling charge amount for a customer/district on a job date. */
export function resolveTravellingChargeAmount(customerId, districtId, jobDate, charges = null) {
  const rows = charges ?? readTravellingChargesFile().charges ?? [];
  const scoped = rows.filter(
    (row) => row.customerId === customerId && row.districtId === districtId,
  );
  const entry = resolveTravellingChargeEntryForDate(scoped, jobDate);
  return entry?.amount ?? null;
}

/** §1.1 — Project flag determines whether travelling charges apply to its jobs. */
export function shouldApplyTravellingChargesForProject(project) {
  if (!project) return false;
  return project.travellingCharges === 'billable_by_table' || project.travellingCharges === 'billable_by_km';
}

export function shouldApplyTravellingChargesForProjectId(projectId) {
  if (!projectId) return false;
  return shouldApplyTravellingChargesForProject(findProjectRecordById(projectId));
}

/** §1.4 — Whether a charge entry applies on at least one day in [dateFrom, dateTo]. */
function isTravellingChargeApplicableInRange(entry, groupEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validityFrom > rangeTo) return false;

  const sorted = [...groupEntries].sort((a, b) => a.validityFrom.localeCompare(b.validityFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextValidityFrom =
    index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validityFrom : null;

  return !nextValidityFrom || nextValidityFrom > rangeFrom;
}

function filterTravellingChargesByApplicableDate(rows, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return rows;

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.customerId}::${row.districtId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return rows.filter((row) => {
    const key = `${row.customerId}::${row.districtId}`;
    return isTravellingChargeApplicableInRange(row, groups.get(key) ?? [row], dateFrom, dateTo);
  });
}

export function listTravellingChargeRecords(options = {}) {
  const customerId = normalizeCustomerId(options.customerId);
  const districtId = normalizeDistrictId(options.districtId);
  const dateFrom = normalizeValidityFrom(options.dateFrom);
  const dateTo = normalizeValidityFrom(options.dateTo);

  let rows = readTravellingChargesFile().charges ?? [];
  if (customerId) {
    rows = rows.filter((row) => row.customerId === customerId);
  }
  if (districtId) {
    rows = rows.filter((row) => row.districtId === districtId);
  }
  rows = filterTravellingChargesByApplicableDate(rows, dateFrom, dateTo);

  return rows
    .map(toPublicTravellingCharge)
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }) ||
        a.districtName.localeCompare(b.districtName, undefined, { sensitivity: 'base' }) ||
        b.validityFrom.localeCompare(a.validityFrom),
    );
}

export function findTravellingChargeById(chargeId) {
  if (!chargeId) return null;
  const data = readTravellingChargesFile();
  return data.charges.find((row) => row.id === chargeId) ?? null;
}

export function findTravellingChargeRecordById(chargeId) {
  const charge = findTravellingChargeById(chargeId);
  if (!charge) return null;
  return toPublicTravellingCharge(charge);
}

function validateTravellingChargeInput(input, { existingId = null } = {}) {
  const errors = [];
  const customerId = normalizeCustomerId(input.customerId);
  const districtId = normalizeDistrictId(input.districtId);
  const amount = normalizeTravellingChargeAmount(input.amount);
  const validityFrom = normalizeValidityFrom(input.validityFrom);

  if (!customerId) {
    errors.push('travellingChargeCustomerRequired');
  } else if (!findCustomerById(customerId)) {
    errors.push('travellingChargeCustomerInvalid');
  }

  if (!districtId) {
    errors.push('travellingChargeDistrictRequired');
  } else if (!isEnabledDistrict(districtId)) {
    errors.push('travellingChargeDistrictInvalid');
  }

  if (amount === null) {
    errors.push('travellingChargeAmountRequired');
  }

  if (!validityFrom) {
    errors.push('travellingChargeValidityFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const data = readTravellingChargesFile();
  const duplicate = (data.charges ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.customerId === customerId &&
      row.districtId === districtId &&
      row.validityFrom === validityFrom,
  );
  if (duplicate) {
    return { errors: ['travellingChargeDuplicate'] };
  }

  return {
    value: {
      customerId,
      districtId,
      amount,
      validityFrom,
    },
  };
}

export function createTravellingCharge(input) {
  const validation = validateTravellingChargeInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readTravellingChargesFile();
  const now = new Date().toISOString();
  const charge = {
    id: generateTravellingChargeId(),
    customerId: validation.value.customerId,
    districtId: validation.value.districtId,
    amount: validation.value.amount,
    validityFrom: validation.value.validityFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.charges.push(charge);
  writeTravellingChargesFile(data);
  return { charge: toPublicTravellingCharge(charge) };
}

export function updateTravellingCharge(chargeId, input) {
  const data = readTravellingChargesFile();
  const index = (data.charges ?? []).findIndex((row) => row.id === chargeId);
  if (index === -1) {
    return { errors: ['travellingChargeNotFound'] };
  }

  const validation = validateTravellingChargeInput(input, { existingId: chargeId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.charges[index],
    customerId: validation.value.customerId,
    districtId: validation.value.districtId,
    amount: validation.value.amount,
    validityFrom: validation.value.validityFrom,
    updatedAt: new Date().toISOString(),
  };

  data.charges[index] = updated;
  writeTravellingChargesFile(data);
  return { charge: toPublicTravellingCharge(updated) };
}

export function isTravellingChargeReferencedByJob(charge) {
  if (!charge) return false;

  const data = readTravellingChargesFile();
  const scoped = (data.charges ?? []).filter(
    (row) => row.customerId === charge.customerId && row.districtId === charge.districtId,
  );

  return listJobRecords().some((job) => {
    if (job.customerId !== charge.customerId) return false;
    if (job.districtId !== charge.districtId) return false;
    const resolved = resolveTravellingChargeEntryForDate(scoped, job.date);
    return resolved?.id === charge.id;
  });
}

export function deleteTravellingCharge(chargeId) {
  const data = readTravellingChargesFile();
  const index = (data.charges ?? []).findIndex((row) => row.id === chargeId);
  if (index === -1) {
    return { errors: ['travellingChargeNotFound'] };
  }

  const charge = data.charges[index];
  if (isTravellingChargeReferencedByJob(charge)) {
    return { errors: ['travellingChargeReferencedByJob'] };
  }

  const [removed] = data.charges.splice(index, 1);
  writeTravellingChargesFile(data);
  return { charge: toPublicTravellingCharge(removed) };
}
