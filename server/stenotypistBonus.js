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
import { listJobRecords } from './jobs.js';
import { canAccessBonusConfigurationModule } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { normalizeValidityFrom } from './travellingTimes.js';
import { resolveTravellingChargeEntryForDate } from './travellingCharges.js';

const BONUS_CONFIG_PATH = path.join(DB_DIR, 'stenotypistBonusConfigurations.json');

/** §4.1 — Default bonus settings when no configuration exists. */
export const DEFAULT_BONUS_BASE_HOURS = 40;
export const DEFAULT_BONUS_PER_EXTRA_HOUR = 20;

function readBonusConfigurationsFile() {
  ensureCollectionFile('stenotypistBonusConfigurations', { configurations: [] });
  return readCollection('stenotypistBonusConfigurations', { configurations: [] });
}

function writeBonusConfigurationsFile(data) {
  writeCollection('stenotypistBonusConfigurations', data);
}

function generateBonusConfigurationId() {
  return `bonus-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeBonusBaseHours(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 1000) / 1000;
}

export function normalizeBonusPerExtraHour(value) {
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

function isActiveStenotypist(userId) {
  const user = findUserById(userId);
  if (!user || user.status !== 'active') return false;
  return normalizeRoles(user).includes('stenotypist');
}

function migrateBonusConfigurationRecord(record) {
  const now = new Date().toISOString();
  return {
    id: record.id ?? generateBonusConfigurationId(),
    stenotypistUserId: normalizeStenotypistUserId(record.stenotypistUserId),
    baseHours: normalizeBonusBaseHours(record.baseHours) ?? DEFAULT_BONUS_BASE_HOURS,
    bonusPerExtraHour:
      normalizeBonusPerExtraHour(record.bonusPerExtraHour) ?? DEFAULT_BONUS_PER_EXTRA_HOUR,
    validFrom: normalizeValidityFrom(record.validFrom ?? record.validityFrom),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureStenotypistBonusDatabase() {
  ensureCollectionFile('stenotypistBonusConfigurations', { configurations: [] });
}

function toPublicStenotypist(userId) {
  const user = findUserById(userId);
  return {
    id: user?.id ?? userId,
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
  };
}

function toPublicBonusConfiguration(record) {
  const stenotypist = toPublicStenotypist(record.stenotypistUserId);
  return {
    id: record.id,
    stenotypistUserId: record.stenotypistUserId,
    stenotypistFullName: stenotypist.fullName,
    stenotypistUsername: stenotypist.username,
    baseHours: record.baseHours,
    bonusPerExtraHour: record.bonusPerExtraHour,
    validFrom: record.validFrom,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function assertBonusConfigurationAccess(actor) {
  if (!canAccessBonusConfigurationModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function listConfigurationsForStenotypist(stenotypistUserId) {
  const data = readBonusConfigurationsFile();
  return (data.configurations ?? []).filter((row) => row.stenotypistUserId === stenotypistUserId);
}

/**
 * §4.1 — Pick the bonus configuration valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 */
export function resolveBonusConfigurationEntryForDate(entries, jobDate) {
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

/** §4.1 — Resolve applicable bonus settings for a stenotypist on a given date. */
export function resolveBonusConfigurationForStenotypist(stenotypistUserId, jobDate) {
  const entries = listConfigurationsForStenotypist(stenotypistUserId);
  const resolved = resolveBonusConfigurationEntryForDate(entries, jobDate);
  if (resolved) {
    return {
      id: resolved.id,
      stenotypistUserId,
      baseHours: resolved.baseHours,
      bonusPerExtraHour: resolved.bonusPerExtraHour,
      validFrom: resolved.validFrom,
      isDefault: false,
    };
  }

  return {
    id: null,
    stenotypistUserId,
    baseHours: DEFAULT_BONUS_BASE_HOURS,
    bonusPerExtraHour: DEFAULT_BONUS_PER_EXTRA_HOUR,
    validFrom: null,
    isDefault: true,
  };
}

function isBonusConfigurationApplicableInRange(entry, groupEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validFrom > rangeTo) return false;

  const sorted = [...groupEntries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextValidFrom = index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validFrom : null;

  return !nextValidFrom || nextValidFrom > rangeFrom;
}

function filterBonusConfigurationsByApplicableDate(rows, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return rows;

  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.stenotypistUserId) ?? [];
    group.push(row);
    groups.set(row.stenotypistUserId, group);
  }

  return rows.filter((row) => {
    const group = groups.get(row.stenotypistUserId) ?? [row];
    return isBonusConfigurationApplicableInRange(row, group, dateFrom, dateTo);
  });
}

export function listBonusConfigurationRecords(actor, options = {}) {
  const denied = assertBonusConfigurationAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = normalizeStenotypistUserId(options.stenotypistUserId);
  const dateFrom = normalizeValidityFrom(options.dateFrom);
  const dateTo = normalizeValidityFrom(options.dateTo);

  let rows = readBonusConfigurationsFile().configurations ?? [];
  if (stenotypistUserId) {
    rows = rows.filter((row) => row.stenotypistUserId === stenotypistUserId);
  }
  rows = filterBonusConfigurationsByApplicableDate(rows, dateFrom, dateTo);

  return {
    configurations: rows
      .map(toPublicBonusConfiguration)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
  };
}

export function findBonusConfigurationRecordById(configurationId, actor) {
  const denied = assertBonusConfigurationAccess(actor);
  if (denied) return denied;

  const record = (readBonusConfigurationsFile().configurations ?? []).find(
    (row) => row.id === configurationId,
  );
  if (!record) {
    return { errors: ['bonusConfigurationNotFound'] };
  }

  return { configuration: toPublicBonusConfiguration(record) };
}

function validateBonusConfigurationInput(input, { existingId = null } = {}) {
  const errors = [];
  const stenotypistUserId = normalizeStenotypistUserId(input.stenotypistUserId);
  const baseHours = normalizeBonusBaseHours(input.baseHours);
  const bonusPerExtraHour = normalizeBonusPerExtraHour(input.bonusPerExtraHour);
  const validFrom = normalizeValidityFrom(input.validFrom ?? input.validityFrom);

  if (!stenotypistUserId) {
    errors.push('bonusConfigurationStenotypistRequired');
  } else if (!isActiveStenotypist(stenotypistUserId)) {
    errors.push('bonusConfigurationStenotypistInvalid');
  }

  if (baseHours === null) {
    errors.push('bonusConfigurationBaseHoursInvalid');
  }

  if (bonusPerExtraHour === null) {
    errors.push('bonusConfigurationBonusPerExtraHourInvalid');
  }

  if (!validFrom) {
    errors.push('bonusConfigurationValidFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const duplicate = (readBonusConfigurationsFile().configurations ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.stenotypistUserId === stenotypistUserId &&
      row.validFrom === validFrom,
  );
  if (duplicate) {
    return { errors: ['bonusConfigurationValidFromDuplicate'] };
  }

  return {
    value: {
      stenotypistUserId,
      baseHours,
      bonusPerExtraHour,
      validFrom,
    },
  };
}

export function createBonusConfigurationRecord(input, actor) {
  const denied = assertBonusConfigurationAccess(actor);
  if (denied) return denied;

  const validation = validateBonusConfigurationInput(input);
  if (validation.errors) {
    return validation;
  }

  const data = readBonusConfigurationsFile();
  const now = new Date().toISOString();
  const record = {
    id: generateBonusConfigurationId(),
    stenotypistUserId: validation.value.stenotypistUserId,
    baseHours: validation.value.baseHours,
    bonusPerExtraHour: validation.value.bonusPerExtraHour,
    validFrom: validation.value.validFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.configurations = [...(data.configurations ?? []), record];
  writeBonusConfigurationsFile(data);
  return { configuration: toPublicBonusConfiguration(record) };
}

export function updateBonusConfigurationRecord(configurationId, input, actor) {
  const denied = assertBonusConfigurationAccess(actor);
  if (denied) return denied;

  const data = readBonusConfigurationsFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['bonusConfigurationNotFound'] };
  }

  const validation = validateBonusConfigurationInput(input, { existingId: configurationId });
  if (validation.errors) {
    return validation;
  }

  const updated = {
    ...data.configurations[index],
    stenotypistUserId: validation.value.stenotypistUserId,
    baseHours: validation.value.baseHours,
    bonusPerExtraHour: validation.value.bonusPerExtraHour,
    validFrom: validation.value.validFrom,
    updatedAt: new Date().toISOString(),
  };

  data.configurations[index] = updated;
  writeBonusConfigurationsFile(data);
  return { configuration: toPublicBonusConfiguration(updated) };
}

/** §4.4 — Whether any job resolves to this bonus configuration on its date. */
export function isBonusConfigurationReferencedByJob(configuration) {
  if (!configuration) return false;

  const entries = listConfigurationsForStenotypist(configuration.stenotypistUserId);
  return listJobRecords(null).some((job) => {
    if (job.stenotypistUserId !== configuration.stenotypistUserId) return false;
    const resolved = resolveBonusConfigurationEntryForDate(entries, job.date);
    return resolved?.id === configuration.id;
  });
}

export function deleteBonusConfigurationRecord(configurationId, actor) {
  const denied = assertBonusConfigurationAccess(actor);
  if (denied) return denied;

  const data = readBonusConfigurationsFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['bonusConfigurationNotFound'] };
  }

  const configuration = data.configurations[index];
  if (isBonusConfigurationReferencedByJob(configuration)) {
    return { errors: ['bonusConfigurationReferencedByJob'] };
  }

  const [removed] = data.configurations.splice(index, 1);
  writeBonusConfigurationsFile(data);
  return { configuration: toPublicBonusConfiguration(removed) };
}

export function listBonusStenotypistCandidates(actor) {
  return listUsers()
    .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}
