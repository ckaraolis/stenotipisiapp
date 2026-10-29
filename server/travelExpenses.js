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
import { findUserById, listUsers } from './db.js';
import { findDistrictById } from './districts.js';
import { listJobRecords } from './jobs.js';
import { canAccessTravelExpenseConfigurationModule } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { normalizeValidityFrom } from './travellingTimes.js';
import { resolveTravellingChargeEntryForDate } from './travellingCharges.js';

const TRAVEL_EXPENSES_PATH = path.join(DB_DIR, 'travelExpenseConfigurations.json');

/** §6.1 — Same-day multi-job travel in one district is handled manually by a Manager. */
export const TRAVEL_EXPENSE_SAME_DAY_MULTI_JOB_NOTE =
  'Cases where the Stenotypist attended several Jobs at the same District in a single day should be manually handled by the Manager.';

function readTravelExpensesFile() {
  ensureCollectionFile('travelExpenseConfigurations', { configurations: [] });
  return readCollection('travelExpenseConfigurations', { configurations: [] });
}

function writeTravelExpensesFile(data) {
  writeCollection('travelExpenseConfigurations', data);
}

function generateTravelExpenseId() {
  return `te-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeTravelExpenseAmount(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

function normalizeStenotypistUserId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDistrictId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isActiveStenotypist(userId) {
  const user = findUserById(userId);
  if (!user || user.status !== 'active') return false;
  return normalizeRoles(user).includes('stenotypist');
}

function isEnabledDistrict(districtId) {
  const district = findDistrictById(districtId);
  return Boolean(district && district.enabled !== false);
}

function migrateTravelExpenseRecord(record) {
  const now = new Date().toISOString();
  return {
    id: record.id ?? generateTravelExpenseId(),
    stenotypistUserId: normalizeStenotypistUserId(record.stenotypistUserId),
    districtId: normalizeDistrictId(record.districtId),
    amount: normalizeTravelExpenseAmount(record.amount) ?? 0,
    validFrom: normalizeValidityFrom(record.validFrom ?? record.validityFrom),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureTravelExpensesDatabase() {
  ensureCollectionFile('travelExpenseConfigurations', { configurations: [] });
}

function toPublicStenotypist(userId) {
  const user = findUserById(userId);
  return {
    id: user?.id ?? userId,
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
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

function toPublicTravelExpense(record) {
  const stenotypist = toPublicStenotypist(record.stenotypistUserId);
  const district = toPublicDistrict(record.districtId);
  return {
    id: record.id,
    stenotypistUserId: record.stenotypistUserId,
    stenotypistFullName: stenotypist.fullName,
    stenotypistUsername: stenotypist.username,
    districtId: record.districtId,
    districtName: district.name,
    districtAlias: district.alias,
    amount: record.amount,
    validFrom: record.validFrom,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function assertTravelExpenseAccess(actor) {
  if (!canAccessTravelExpenseConfigurationModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function listConfigurationsForPair(stenotypistUserId, districtId) {
  return (readTravelExpensesFile().configurations ?? []).filter(
    (row) => row.stenotypistUserId === stenotypistUserId && row.districtId === districtId,
  );
}

/**
 * §6.1 — Pick the travel expense entry valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 */
export function resolveTravelExpenseEntryForDate(entries, jobDate) {
  const normalizedEntries = (entries ?? []).map((entry) => ({
    ...entry,
    validityFrom: entry.validFrom,
  }));
  const resolved = resolveTravellingChargeEntryForDate(normalizedEntries, jobDate);
  if (!resolved) return null;
  return {
    ...resolved,
    validFrom: resolved.validityFrom,
  };
}

/** §6.1 — Resolve payable travel expense for a stenotypist/district on a job date. */
export function resolveTravelExpenseAmount(stenotypistUserId, districtId, jobDate) {
  const entries = listConfigurationsForPair(stenotypistUserId, districtId);
  const resolved = resolveTravelExpenseEntryForDate(entries, jobDate);
  return resolved?.amount ?? null;
}

function isTravelExpenseApplicableInRange(entry, groupEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validFrom > rangeTo) return false;

  const sorted = [...groupEntries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextValidFrom = index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validFrom : null;

  return !nextValidFrom || nextValidFrom > rangeFrom;
}

function filterTravelExpensesByApplicableDate(rows, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return rows;

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.stenotypistUserId}::${row.districtId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return rows.filter((row) => {
    const key = `${row.stenotypistUserId}::${row.districtId}`;
    return isTravelExpenseApplicableInRange(row, groups.get(key) ?? [row], dateFrom, dateTo);
  });
}

export function listTravelExpenseRecords(actor, options = {}) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = normalizeStenotypistUserId(options.stenotypistUserId);
  const districtId = normalizeDistrictId(options.districtId);
  const dateFrom = normalizeValidityFrom(options.dateFrom);
  const dateTo = normalizeValidityFrom(options.dateTo);

  let rows = readTravelExpensesFile().configurations ?? [];
  if (stenotypistUserId) {
    rows = rows.filter((row) => row.stenotypistUserId === stenotypistUserId);
  }
  if (districtId) {
    rows = rows.filter((row) => row.districtId === districtId);
  }
  rows = filterTravelExpensesByApplicableDate(rows, dateFrom, dateTo);

  return {
    configurations: rows
      .map(toPublicTravelExpense)
      .sort(
        (a, b) =>
          a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
            sensitivity: 'base',
          }) ||
          a.districtName.localeCompare(b.districtName, undefined, { sensitivity: 'base' }) ||
          b.validFrom.localeCompare(a.validFrom),
      ),
  };
}

export function findTravelExpenseRecordById(configurationId, actor) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  const record = (readTravelExpensesFile().configurations ?? []).find(
    (row) => row.id === configurationId,
  );
  if (!record) {
    return { errors: ['travelExpenseNotFound'] };
  }

  return { configuration: toPublicTravelExpense(record) };
}

function validateTravelExpenseInput(input, { existingId = null } = {}) {
  const errors = [];
  const stenotypistUserId = normalizeStenotypistUserId(input.stenotypistUserId);
  const districtId = normalizeDistrictId(input.districtId);
  const amount = normalizeTravelExpenseAmount(input.amount);
  const validFrom = normalizeValidityFrom(input.validFrom ?? input.validityFrom);

  if (!stenotypistUserId) {
    errors.push('travelExpenseStenotypistRequired');
  } else if (!isActiveStenotypist(stenotypistUserId)) {
    errors.push('travelExpenseStenotypistInvalid');
  }

  if (!districtId) {
    errors.push('travelExpenseDistrictRequired');
  } else if (!isEnabledDistrict(districtId)) {
    errors.push('travelExpenseDistrictInvalid');
  }

  if (amount === null) {
    errors.push('travelExpenseAmountInvalid');
  }

  if (!validFrom) {
    errors.push('travelExpenseValidFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const duplicate = (readTravelExpensesFile().configurations ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.stenotypistUserId === stenotypistUserId &&
      row.districtId === districtId &&
      row.validFrom === validFrom,
  );
  if (duplicate) {
    return { errors: ['travelExpenseValidFromDuplicate'] };
  }

  return {
    value: {
      stenotypistUserId,
      districtId,
      amount,
      validFrom,
    },
  };
}

export function createTravelExpenseRecord(input, actor) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  const validation = validateTravelExpenseInput(input);
  if (validation.errors) {
    return validation;
  }

  const data = readTravelExpensesFile();
  const now = new Date().toISOString();
  const record = {
    id: generateTravelExpenseId(),
    stenotypistUserId: validation.value.stenotypistUserId,
    districtId: validation.value.districtId,
    amount: validation.value.amount,
    validFrom: validation.value.validFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.configurations = [...(data.configurations ?? []), record];
  writeTravelExpensesFile(data);
  return { configuration: toPublicTravelExpense(record) };
}

export function updateTravelExpenseRecord(configurationId, input, actor) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  const data = readTravelExpensesFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['travelExpenseNotFound'] };
  }

  const validation = validateTravelExpenseInput(input, { existingId: configurationId });
  if (validation.errors) {
    return validation;
  }

  const updated = {
    ...data.configurations[index],
    stenotypistUserId: validation.value.stenotypistUserId,
    districtId: validation.value.districtId,
    amount: validation.value.amount,
    validFrom: validation.value.validFrom,
    updatedAt: new Date().toISOString(),
  };

  data.configurations[index] = updated;
  writeTravelExpensesFile(data);
  return { configuration: toPublicTravelExpense(updated) };
}

/** Whether any job resolves to this travel expense configuration on its date. */
export function isTravelExpenseReferencedByJob(configuration) {
  if (!configuration) return false;

  const entries = listConfigurationsForPair(
    configuration.stenotypistUserId,
    configuration.districtId,
  );
  return listJobRecords(null).some((job) => {
    if (job.stenotypistUserId !== configuration.stenotypistUserId) return false;
    if (job.districtId !== configuration.districtId) return false;
    const resolved = resolveTravelExpenseEntryForDate(entries, job.date);
    return resolved?.id === configuration.id;
  });
}

export function deleteTravelExpenseRecord(configurationId, actor) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  const data = readTravelExpensesFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['travelExpenseNotFound'] };
  }

  const configuration = data.configurations[index];
  if (isTravelExpenseReferencedByJob(configuration)) {
    return { errors: ['travelExpenseReferencedByJob'] };
  }

  const [removed] = data.configurations.splice(index, 1);
  writeTravelExpensesFile(data);
  return { configuration: toPublicTravelExpense(removed) };
}

export function listTravelExpenseStenotypistCandidates(actor) {
  const denied = assertTravelExpenseAccess(actor);
  if (denied) return denied;

  return {
    candidates: listUsers()
      .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })),
  };
}
