import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import crypto from 'node:crypto';
import { findUserById, listUsers } from './db.js';
import { listJobRecords } from './jobs.js';
import { canAccessBonusConfigurationModule } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { normalizeValidityFrom } from './travellingTimes.js';
import { resolveTravellingChargeEntryForDate } from './travellingCharges.js';

/** §4.1 — Default bonus thresholds (ASTRAEA H1/H2; T1/TF%/PPHF unused). */
export const DEFAULT_BONUS_H1 = 52;
export const DEFAULT_BONUS_H2 = 72;
export const DEFAULT_BONUS_H1_EUR = 20;
export const DEFAULT_BONUS_H2_EUR = 20;

/** @deprecated Prefer DEFAULT_BONUS_H1 */
export const DEFAULT_BONUS_BASE_HOURS = DEFAULT_BONUS_H1;
/** @deprecated Prefer DEFAULT_BONUS_H1_EUR */
export const DEFAULT_BONUS_PER_EXTRA_HOUR = DEFAULT_BONUS_H1_EUR;

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

export function normalizeBonusHoursThreshold(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 1000) / 1000;
}

export function normalizeBonusEuroAmount(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

/** @deprecated Prefer normalizeBonusHoursThreshold */
export function normalizeBonusBaseHours(value) {
  return normalizeBonusHoursThreshold(value);
}

/** @deprecated Prefer normalizeBonusEuroAmount */
export function normalizeBonusPerExtraHour(value) {
  return normalizeBonusEuroAmount(value);
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
  const h1 =
    normalizeBonusHoursThreshold(record.h1 ?? record.baseHours) ?? DEFAULT_BONUS_H1;
  const h2 = normalizeBonusHoursThreshold(record.h2) ?? Math.max(h1, DEFAULT_BONUS_H2);
  const h1BonusEur =
    normalizeBonusEuroAmount(record.h1BonusEur ?? record.bonusPerExtraHour) ??
    DEFAULT_BONUS_H1_EUR;
  const h2BonusEur =
    normalizeBonusEuroAmount(record.h2BonusEur) ?? h1BonusEur;

  return {
    id: record.id ?? generateBonusConfigurationId(),
    stenotypistUserId: normalizeStenotypistUserId(record.stenotypistUserId),
    h1,
    h2,
    h1BonusEur,
    h2BonusEur,
    validFrom: normalizeValidityFrom(record.validFrom ?? record.validityFrom),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureStenotypistBonusDatabase() {
  ensureCollectionFile('stenotypistBonusConfigurations', { configurations: [] });
  const data = readBonusConfigurationsFile();
  const rows = data.configurations ?? [];
  let changed = false;
  const migrated = rows.map((row) => {
    const next = migrateBonusConfigurationRecord(row);
    if (
      next.h1 !== row.h1 ||
      next.h2 !== row.h2 ||
      next.h1BonusEur !== row.h1BonusEur ||
      next.h2BonusEur !== row.h2BonusEur ||
      row.baseHours !== undefined ||
      row.bonusPerExtraHour !== undefined
    ) {
      changed = true;
    }
    return next;
  });
  if (changed) {
    writeBonusConfigurationsFile({ configurations: migrated });
  }
}

function toPublicStenotypist(userId) {
  const user = findUserById(userId);
  return {
    id: user?.id ?? userId,
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
    roles: normalizeRoles(user),
  };
}

function toPublicBonusConfiguration(record) {
  const stenotypist = toPublicStenotypist(record.stenotypistUserId);
  const migrated = migrateBonusConfigurationRecord(record);
  return {
    id: migrated.id,
    stenotypistUserId: migrated.stenotypistUserId,
    stenotypistFullName: stenotypist.fullName,
    stenotypistUsername: stenotypist.username,
    stenotypistRoles: stenotypist.roles,
    h1: migrated.h1,
    h2: migrated.h2,
    h1BonusEur: migrated.h1BonusEur,
    h2BonusEur: migrated.h2BonusEur,
    validFrom: migrated.validFrom,
    createdAt: migrated.createdAt,
    updatedAt: migrated.updatedAt,
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
  return (data.configurations ?? [])
    .map(migrateBonusConfigurationRecord)
    .filter((row) => row.stenotypistUserId === stenotypistUserId);
}

/**
 * §4.1 — Pick the bonus configuration valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 */
export function resolveBonusConfigurationEntryForDate(entries, jobDate) {
  const normalizedEntries = (entries ?? []).map((entry) => {
    const migrated = migrateBonusConfigurationRecord(entry);
    return {
      ...migrated,
      validityFrom: migrated.validFrom,
    };
  });
  const resolved = resolveTravellingChargeEntryForDate(normalizedEntries, jobDate);
  if (!resolved) return null;
  return {
    ...resolved,
    validFrom: resolved.validityFrom,
  };
}

/**
 * §4.1 — Two-tier bonus: hours above H1 use H1B€ up to H2; hours above H2 use H2B€.
 * T1 / TF% / PPHF are intentionally unused.
 */
export function computeStenotypistBonusAmount(totalHours, settings) {
  const hours = Number(totalHours);
  const h1 = Number(settings?.h1 ?? settings?.baseHours ?? DEFAULT_BONUS_H1);
  const h2 = Number(settings?.h2 ?? Math.max(h1, DEFAULT_BONUS_H2));
  const h1BonusEur = Number(
    settings?.h1BonusEur ?? settings?.bonusPerExtraHour ?? DEFAULT_BONUS_H1_EUR,
  );
  const h2BonusEur = Number(settings?.h2BonusEur ?? h1BonusEur);

  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeH1 = Number.isFinite(h1) && h1 > 0 ? h1 : DEFAULT_BONUS_H1;
  const safeH2 = Number.isFinite(h2) && h2 >= safeH1 ? h2 : Math.max(safeH1, DEFAULT_BONUS_H2);
  const safeH1Bonus =
    Number.isFinite(h1BonusEur) && h1BonusEur > 0 ? h1BonusEur : DEFAULT_BONUS_H1_EUR;
  const safeH2Bonus =
    Number.isFinite(h2BonusEur) && h2BonusEur > 0 ? h2BonusEur : safeH1Bonus;

  const extraHours = Math.max(0, safeHours - safeH1);
  let bonus = 0;
  if (safeHours > safeH1) {
    if (safeHours <= safeH2) {
      bonus = (safeHours - safeH1) * safeH1Bonus;
    } else {
      bonus = (safeH2 - safeH1) * safeH1Bonus + (safeHours - safeH2) * safeH2Bonus;
    }
  }

  return {
    h1: safeH1,
    h2: safeH2,
    h1BonusEur: safeH1Bonus,
    h2BonusEur: safeH2Bonus,
    extraHours: Math.round(extraHours * 1000) / 1000,
    bonus: Math.round(bonus * 100) / 100,
    // Compatibility aliases for existing consumers.
    baseHours: safeH1,
    bonusPerExtraHour: safeH1Bonus,
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
      h1: resolved.h1,
      h2: resolved.h2,
      h1BonusEur: resolved.h1BonusEur,
      h2BonusEur: resolved.h2BonusEur,
      validFrom: resolved.validFrom,
      isDefault: false,
      baseHours: resolved.h1,
      bonusPerExtraHour: resolved.h1BonusEur,
    };
  }

  return {
    id: null,
    stenotypistUserId,
    h1: DEFAULT_BONUS_H1,
    h2: DEFAULT_BONUS_H2,
    h1BonusEur: DEFAULT_BONUS_H1_EUR,
    h2BonusEur: DEFAULT_BONUS_H2_EUR,
    validFrom: null,
    isDefault: true,
    baseHours: DEFAULT_BONUS_H1,
    bonusPerExtraHour: DEFAULT_BONUS_H1_EUR,
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

  let rows = (readBonusConfigurationsFile().configurations ?? []).map(
    migrateBonusConfigurationRecord,
  );
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
  const h1 = normalizeBonusHoursThreshold(input.h1 ?? input.baseHours);
  const h2 = normalizeBonusHoursThreshold(input.h2);
  const h1BonusEur = normalizeBonusEuroAmount(input.h1BonusEur ?? input.bonusPerExtraHour);
  const h2BonusEur = normalizeBonusEuroAmount(input.h2BonusEur);
  const validFrom = normalizeValidityFrom(input.validFrom ?? input.validityFrom);

  if (!stenotypistUserId) {
    errors.push('bonusConfigurationStenotypistRequired');
  } else if (!isActiveStenotypist(stenotypistUserId)) {
    errors.push('bonusConfigurationStenotypistInvalid');
  }

  if (h1 === null) {
    errors.push('bonusConfigurationH1Invalid');
  }

  if (h2 === null) {
    errors.push('bonusConfigurationH2Invalid');
  } else if (h1 !== null && h2 < h1) {
    errors.push('bonusConfigurationH2LessThanH1');
  }

  if (h1BonusEur === null) {
    errors.push('bonusConfigurationH1BonusInvalid');
  }

  if (h2BonusEur === null) {
    errors.push('bonusConfigurationH2BonusInvalid');
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
      migrateBonusConfigurationRecord(row).validFrom === validFrom,
  );
  if (duplicate) {
    return { errors: ['bonusConfigurationValidFromDuplicate'] };
  }

  return {
    value: {
      stenotypistUserId,
      h1,
      h2,
      h1BonusEur,
      h2BonusEur,
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
    h1: validation.value.h1,
    h2: validation.value.h2,
    h1BonusEur: validation.value.h1BonusEur,
    h2BonusEur: validation.value.h2BonusEur,
    validFrom: validation.value.validFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.configurations = [
    ...(data.configurations ?? []).map(migrateBonusConfigurationRecord),
    record,
  ];
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

  const existing = migrateBonusConfigurationRecord(data.configurations[index]);
  const updated = {
    ...existing,
    stenotypistUserId: validation.value.stenotypistUserId,
    h1: validation.value.h1,
    h2: validation.value.h2,
    h1BonusEur: validation.value.h1BonusEur,
    h2BonusEur: validation.value.h2BonusEur,
    validFrom: validation.value.validFrom,
    updatedAt: new Date().toISOString(),
  };

  data.configurations = (data.configurations ?? []).map(migrateBonusConfigurationRecord);
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

  const configuration = migrateBonusConfigurationRecord(data.configurations[index]);
  if (isBonusConfigurationReferencedByJob(configuration)) {
    return { errors: ['bonusConfigurationReferencedByJob'] };
  }

  const [removed] = data.configurations.splice(index, 1);
  writeBonusConfigurationsFile({
    configurations: (data.configurations ?? []).map(migrateBonusConfigurationRecord),
  });
  return { configuration: toPublicBonusConfiguration(removed) };
}

export function listBonusStenotypistCandidates(actor) {
  return listUsers()
    .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      roles: normalizeRoles(user),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}
