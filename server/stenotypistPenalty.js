import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import crypto from 'node:crypto';
import { findUserById, listUsers } from './db.js';
import { findCustomerById } from './customers.js';
import { listJobRecords } from './jobs.js';
import { findProjectRecordById } from './projects.js';
import { canAccessPenaltyConfigurationModule } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { normalizeValidityFrom } from './travellingTimes.js';
import { resolveTravellingChargeEntryForDate } from './travellingCharges.js';

/** §5.1 — Default penalty settings (ASTRAEA: Target Hours Before Deadline / Penalty Per Hour Late). */
export const DEFAULT_TARGET_HOURS_BEFORE_DEADLINE = 1;
export const DEFAULT_PENALTY_PER_HOUR_LATE = 10;

/** @deprecated Prefer DEFAULT_TARGET_HOURS_BEFORE_DEADLINE */
export const DEFAULT_PENALTY_GRACE_PERIOD_HOURS = DEFAULT_TARGET_HOURS_BEFORE_DEADLINE;
/** @deprecated Base penalty is unused in ASTRAEA model. */
export const DEFAULT_PENALTY_BASE_AMOUNT = 0;
/** @deprecated Prefer DEFAULT_PENALTY_PER_HOUR_LATE */
export const DEFAULT_PENALTY_EXTRA_PER_HOUR = DEFAULT_PENALTY_PER_HOUR_LATE;

const PENALTY_ELIGIBLE_JOB_STATUSES = new Set(['reconciled', 'invoiced']);

function readPenaltyConfigurationsFile() {
  ensureCollectionFile('stenotypistPenaltyConfigurations', { configurations: [] });
  return readCollection('stenotypistPenaltyConfigurations', { configurations: [] });
}

function writePenaltyConfigurationsFile(data) {
  writeCollection('stenotypistPenaltyConfigurations', data);
}

function generatePenaltyConfigurationId() {
  return `penalty-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeTargetHoursBeforeDeadline(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || !Number.isInteger(number)) {
    return null;
  }
  return number;
}

/** @deprecated Prefer normalizeTargetHoursBeforeDeadline */
export function normalizePenaltyGracePeriodHours(value) {
  return normalizeTargetHoursBeforeDeadline(value);
}

export function normalizePenaltyPerHourLate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

/** @deprecated Prefer normalizePenaltyPerHourLate */
export function normalizePenaltyExtraPerHour(value) {
  return normalizePenaltyPerHourLate(value);
}

export function normalizePenaltyBaseAmount(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
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

function migratePenaltyConfigurationRecord(record) {
  const now = new Date().toISOString();
  const targetHoursBeforeDeadline =
    normalizeTargetHoursBeforeDeadline(
      record.targetHoursBeforeDeadline ?? record.gracePeriodHours,
    ) ?? DEFAULT_TARGET_HOURS_BEFORE_DEADLINE;
  const penaltyPerHourLate =
    normalizePenaltyPerHourLate(record.penaltyPerHourLate ?? record.extraPenaltyPerHour) ??
    DEFAULT_PENALTY_PER_HOUR_LATE;

  return {
    id: record.id ?? generatePenaltyConfigurationId(),
    stenotypistUserId: normalizeStenotypistUserId(record.stenotypistUserId),
    targetHoursBeforeDeadline,
    penaltyPerHourLate,
    // Kept for older calculation consumers; ASTRAEA UI does not edit this.
    basePenalty: normalizePenaltyBaseAmount(record.basePenalty) ?? 0,
    validFrom: normalizeValidityFrom(record.validFrom ?? record.validityFrom),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureStenotypistPenaltyDatabase() {
  ensureCollectionFile('stenotypistPenaltyConfigurations', { configurations: [] });
  const data = readPenaltyConfigurationsFile();
  const rows = data.configurations ?? [];
  let changed = false;
  const migrated = rows.map((row) => {
    const next = migratePenaltyConfigurationRecord(row);
    if (
      next.targetHoursBeforeDeadline !== row.targetHoursBeforeDeadline ||
      next.penaltyPerHourLate !== row.penaltyPerHourLate ||
      next.stenotypistUserId !== row.stenotypistUserId ||
      row.gracePeriodHours !== undefined ||
      row.extraPenaltyPerHour !== undefined
    ) {
      changed = true;
    }
    return next;
  });
  if (changed) {
    writePenaltyConfigurationsFile({ configurations: migrated });
  }
}

function toPublicStenotypist(userId) {
  const user = findUserById(userId);
  return {
    id: user?.id ?? userId,
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
  };
}

function toPublicPenaltyConfiguration(record) {
  const migrated = migratePenaltyConfigurationRecord(record);
  const stenotypist = toPublicStenotypist(migrated.stenotypistUserId);
  return {
    id: migrated.id,
    stenotypistUserId: migrated.stenotypistUserId,
    stenotypistFullName: stenotypist.fullName,
    stenotypistUsername: stenotypist.username,
    targetHoursBeforeDeadline: migrated.targetHoursBeforeDeadline,
    penaltyPerHourLate: migrated.penaltyPerHourLate,
    // Compatibility aliases for older list/calc views.
    gracePeriodHours: migrated.targetHoursBeforeDeadline,
    basePenalty: migrated.basePenalty,
    extraPenaltyPerHour: migrated.penaltyPerHourLate,
    validFrom: migrated.validFrom,
    createdAt: migrated.createdAt,
    updatedAt: migrated.updatedAt,
  };
}

function assertPenaltyConfigurationAccess(actor) {
  if (!canAccessPenaltyConfigurationModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function listConfigurationsForStenotypist(stenotypistUserId) {
  return (readPenaltyConfigurationsFile().configurations ?? [])
    .map(migratePenaltyConfigurationRecord)
    .filter((row) => row.stenotypistUserId === stenotypistUserId);
}

/**
 * §5.1 — Pick the penalty configuration valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 */
export function resolvePenaltyConfigurationEntryForDate(entries, jobDate) {
  const normalizedEntries = (entries ?? []).map((entry) => {
    const migrated = migratePenaltyConfigurationRecord(entry);
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

/** §5.1 — Resolve applicable penalty settings for a stenotypist on a job date. */
export function resolvePenaltyConfigurationForStenotypist(stenotypistUserId, jobDate) {
  const entries = listConfigurationsForStenotypist(stenotypistUserId);
  const resolved = resolvePenaltyConfigurationEntryForDate(entries, jobDate);
  if (resolved) {
    return {
      id: resolved.id,
      stenotypistUserId,
      targetHoursBeforeDeadline: resolved.targetHoursBeforeDeadline,
      penaltyPerHourLate: resolved.penaltyPerHourLate,
      basePenalty: resolved.basePenalty ?? 0,
      gracePeriodHours: resolved.targetHoursBeforeDeadline,
      extraPenaltyPerHour: resolved.penaltyPerHourLate,
      validFrom: resolved.validFrom,
      isDefault: false,
    };
  }

  return {
    id: null,
    stenotypistUserId,
    targetHoursBeforeDeadline: DEFAULT_TARGET_HOURS_BEFORE_DEADLINE,
    penaltyPerHourLate: DEFAULT_PENALTY_PER_HOUR_LATE,
    basePenalty: 0,
    gracePeriodHours: DEFAULT_TARGET_HOURS_BEFORE_DEADLINE,
    extraPenaltyPerHour: DEFAULT_PENALTY_PER_HOUR_LATE,
    validFrom: null,
    isDefault: true,
  };
}

/**
 * @deprecated Prefer resolvePenaltyConfigurationForStenotypist.
 * Falls back to defaults when stenotypist is unknown.
 */
export function resolvePenaltyConfigurationForDate(jobDate, stenotypistUserId = '') {
  if (stenotypistUserId) {
    return resolvePenaltyConfigurationForStenotypist(stenotypistUserId, jobDate);
  }
  return {
    id: null,
    stenotypistUserId: '',
    targetHoursBeforeDeadline: DEFAULT_TARGET_HOURS_BEFORE_DEADLINE,
    penaltyPerHourLate: DEFAULT_PENALTY_PER_HOUR_LATE,
    basePenalty: 0,
    gracePeriodHours: DEFAULT_TARGET_HOURS_BEFORE_DEADLINE,
    extraPenaltyPerHour: DEFAULT_PENALTY_PER_HOUR_LATE,
    validFrom: null,
    isDefault: true,
  };
}

function parseTimeToMinutes(value) {
  if (typeof value !== 'string' || !value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function getJobEndDateTime(job) {
  const endTime = job.endTimeAdministrator || job.endTimeStenotypist || job.time;
  const minutes = parseTimeToMinutes(endTime);
  if (minutes === null || !job.date) return null;
  const date = new Date(`${job.date}T12:00:00`);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function slaToHours(sla) {
  if (typeof sla !== 'string') return 24;
  const match = sla.trim().match(/^(\d+)\s*day/i);
  if (!match) return 24;
  return Number(match[1]) * 24;
}

export function getCustomerSlaForJob(job) {
  const project = findProjectRecordById(job.projectId);
  if (!project?.customerId) return '1 day';
  const customer = findCustomerById(project.customerId);
  return customer?.sla ?? '1 day';
}

function getSubmissionDateTime(submission) {
  const submittedAt = submission?.completedAt;
  if (!submittedAt) return null;
  const date = new Date(submittedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** §5.1 — Hours between SLA deadline (job end + SLA) and submission. */
export function getTranscriptDelayHoursBeyondSla(job, submission) {
  const jobEnd = getJobEndDateTime(job);
  const submittedAt = getSubmissionDateTime(submission);
  if (!jobEnd || !submittedAt) return 0;

  const slaHours = slaToHours(getCustomerSlaForJob(job));
  const slaDeadlineMs = jobEnd.getTime() + slaHours * 60 * 60 * 1000;
  const delayHours = (submittedAt.getTime() - slaDeadlineMs) / (1000 * 60 * 60);
  return delayHours > 0 ? delayHours : 0;
}

/** §5.1 — Whether a transcript was submitted late. */
export function isTranscriptSubmittedLate(job, submission) {
  if (!PENALTY_ELIGIBLE_JOB_STATUSES.has(job?.status)) {
    return false;
  }

  const jobEnd = getJobEndDateTime(job);
  const submittedAt = getSubmissionDateTime(submission);
  if (!jobEnd || !submittedAt) {
    return false;
  }

  const settings = resolvePenaltyConfigurationForStenotypist(
    job.stenotypistUserId ?? '',
    job.date,
  );
  const slaHours = slaToHours(getCustomerSlaForJob(job));
  const lateThresholdMs =
    jobEnd.getTime() +
    (slaHours + settings.targetHoursBeforeDeadline) * 60 * 60 * 1000;

  return submittedAt.getTime() > lateThresholdMs;
}

/** §5.1 — Penalty amount for a late transcript submission. */
export function computeTranscriptPenaltyAmount(job, submission) {
  const details = buildTranscriptPenaltyDetails(job, submission);
  return details?.totalPenalty ?? 0;
}

/** §5.5 — Full late-submission penalty breakdown for list display. */
export function buildTranscriptPenaltyDetails(job, submission) {
  if (!isTranscriptSubmittedLate(job, submission)) {
    return null;
  }

  const jobEnd = getJobEndDateTime(job);
  const submittedAt = getSubmissionDateTime(submission);
  if (!jobEnd || !submittedAt) {
    return null;
  }

  const settings = resolvePenaltyConfigurationForStenotypist(
    job.stenotypistUserId ?? '',
    job.date,
  );
  const serviceLevel = getCustomerSlaForJob(job);
  const slaHours = slaToHours(serviceLevel);
  const requiredSubmissionMs =
    jobEnd.getTime() + (slaHours + settings.targetHoursBeforeDeadline) * 60 * 60 * 1000;
  const delayBeyondSlaHours =
    (submittedAt.getTime() - (jobEnd.getTime() + slaHours * 60 * 60 * 1000)) / (1000 * 60 * 60);
  const delayHours = Math.max(0, delayBeyondSlaHours - settings.targetHoursBeforeDeadline);
  const extraPenalty = Math.round(delayHours * settings.penaltyPerHourLate * 100) / 100;
  const totalPenalty = Math.round(((settings.basePenalty ?? 0) + extraPenalty) * 100) / 100;

  return {
    serviceLevel,
    gracePeriodHours: settings.targetHoursBeforeDeadline,
    targetHoursBeforeDeadline: settings.targetHoursBeforeDeadline,
    basePenalty: settings.basePenalty ?? 0,
    extraPenaltyPerHour: settings.penaltyPerHourLate,
    penaltyPerHourLate: settings.penaltyPerHourLate,
    jobEndDateTime: jobEnd.toISOString(),
    requiredSubmissionDateTime: new Date(requiredSubmissionMs).toISOString(),
    actualSubmissionDateTime: submittedAt.toISOString(),
    delayHours: Math.round(delayHours * 1000) / 1000,
    extraPenalty,
    totalPenalty,
  };
}

function isPenaltyConfigurationApplicableInRange(entry, groupEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validFrom > rangeTo) return false;

  const sorted = [...groupEntries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextValidFrom = index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validFrom : null;

  return !nextValidFrom || nextValidFrom > rangeFrom;
}

function filterPenaltyConfigurationsByApplicableDate(rows, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return rows;

  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.stenotypistUserId) ?? [];
    group.push(row);
    groups.set(row.stenotypistUserId, group);
  }

  return rows.filter((row) => {
    const group = groups.get(row.stenotypistUserId) ?? [row];
    return isPenaltyConfigurationApplicableInRange(row, group, dateFrom, dateTo);
  });
}

export function listPenaltyConfigurationRecords(actor, options = {}) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = normalizeStenotypistUserId(options.stenotypistUserId);
  const dateFrom = normalizeValidityFrom(options.dateFrom);
  const dateTo = normalizeValidityFrom(options.dateTo);

  let rows = (readPenaltyConfigurationsFile().configurations ?? [])
    .map(migratePenaltyConfigurationRecord)
    .filter((row) => row.stenotypistUserId);
  if (stenotypistUserId) {
    rows = rows.filter((row) => row.stenotypistUserId === stenotypistUserId);
  }
  rows = filterPenaltyConfigurationsByApplicableDate(rows, dateFrom, dateTo);

  return {
    configurations: rows
      .map(toPublicPenaltyConfiguration)
      .sort((a, b) => {
        const nameCmp = a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
          sensitivity: 'base',
        });
        if (nameCmp !== 0) return nameCmp;
        return b.validFrom.localeCompare(a.validFrom);
      }),
  };
}

export function findPenaltyConfigurationRecordById(configurationId, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const record = (readPenaltyConfigurationsFile().configurations ?? []).find(
    (row) => row.id === configurationId,
  );
  if (!record) {
    return { errors: ['penaltyConfigurationNotFound'] };
  }

  return { configuration: toPublicPenaltyConfiguration(record) };
}

function validatePenaltyConfigurationInput(input, { existingId = null } = {}) {
  const errors = [];
  const stenotypistUserId = normalizeStenotypistUserId(input.stenotypistUserId);
  const targetHoursBeforeDeadline = normalizeTargetHoursBeforeDeadline(
    input.targetHoursBeforeDeadline ?? input.gracePeriodHours,
  );
  const penaltyPerHourLate = normalizePenaltyPerHourLate(
    input.penaltyPerHourLate ?? input.extraPenaltyPerHour,
  );
  const validFrom = normalizeValidityFrom(input.validFrom ?? input.validityFrom);

  if (!stenotypistUserId) {
    errors.push('penaltyConfigurationStenotypistRequired');
  } else if (!isActiveStenotypist(stenotypistUserId)) {
    errors.push('penaltyConfigurationStenotypistInvalid');
  }

  if (targetHoursBeforeDeadline === null) {
    errors.push('penaltyConfigurationTargetHoursInvalid');
  }

  if (penaltyPerHourLate === null) {
    errors.push('penaltyConfigurationPenaltyPerHourLateInvalid');
  }

  if (!validFrom) {
    errors.push('penaltyConfigurationValidFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const duplicate = (readPenaltyConfigurationsFile().configurations ?? []).find(
    (row) =>
      row.id !== existingId &&
      migratePenaltyConfigurationRecord(row).stenotypistUserId === stenotypistUserId &&
      migratePenaltyConfigurationRecord(row).validFrom === validFrom,
  );
  if (duplicate) {
    return { errors: ['penaltyConfigurationValidFromDuplicate'] };
  }

  return {
    value: {
      stenotypistUserId,
      targetHoursBeforeDeadline,
      penaltyPerHourLate,
      validFrom,
    },
  };
}

export function createPenaltyConfigurationRecord(input, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const validation = validatePenaltyConfigurationInput(input);
  if (validation.errors) {
    return validation;
  }

  const data = readPenaltyConfigurationsFile();
  const now = new Date().toISOString();
  const record = {
    id: generatePenaltyConfigurationId(),
    stenotypistUserId: validation.value.stenotypistUserId,
    targetHoursBeforeDeadline: validation.value.targetHoursBeforeDeadline,
    penaltyPerHourLate: validation.value.penaltyPerHourLate,
    basePenalty: 0,
    validFrom: validation.value.validFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.configurations = [
    ...(data.configurations ?? []).map(migratePenaltyConfigurationRecord),
    record,
  ];
  writePenaltyConfigurationsFile(data);
  return { configuration: toPublicPenaltyConfiguration(record) };
}

export function updatePenaltyConfigurationRecord(configurationId, input, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const data = readPenaltyConfigurationsFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['penaltyConfigurationNotFound'] };
  }

  const validation = validatePenaltyConfigurationInput(input, { existingId: configurationId });
  if (validation.errors) {
    return validation;
  }

  const existing = migratePenaltyConfigurationRecord(data.configurations[index]);
  const updated = {
    ...existing,
    stenotypistUserId: validation.value.stenotypistUserId,
    targetHoursBeforeDeadline: validation.value.targetHoursBeforeDeadline,
    penaltyPerHourLate: validation.value.penaltyPerHourLate,
    basePenalty: 0,
    validFrom: validation.value.validFrom,
    updatedAt: new Date().toISOString(),
  };

  data.configurations = (data.configurations ?? []).map(migratePenaltyConfigurationRecord);
  data.configurations[index] = updated;
  writePenaltyConfigurationsFile(data);
  return { configuration: toPublicPenaltyConfiguration(updated) };
}

/** §5.4 — Whether any job resolves to this penalty configuration on its date. */
export function isPenaltyConfigurationReferencedByJob(configuration) {
  if (!configuration?.stenotypistUserId) return false;

  const entries = listConfigurationsForStenotypist(configuration.stenotypistUserId);
  return listJobRecords(null).some((job) => {
    if (job.stenotypistUserId !== configuration.stenotypistUserId) return false;
    if (!job?.date) return false;
    const resolved = resolvePenaltyConfigurationEntryForDate(entries, job.date);
    return resolved?.id === configuration.id;
  });
}

export function deletePenaltyConfigurationRecord(configurationId, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const data = readPenaltyConfigurationsFile();
  const index = (data.configurations ?? []).findIndex((row) => row.id === configurationId);
  if (index === -1) {
    return { errors: ['penaltyConfigurationNotFound'] };
  }

  const configuration = migratePenaltyConfigurationRecord(data.configurations[index]);
  if (isPenaltyConfigurationReferencedByJob(configuration)) {
    return { errors: ['penaltyConfigurationReferencedByJob'] };
  }

  const [removed] = data.configurations.splice(index, 1);
  writePenaltyConfigurationsFile({
    configurations: (data.configurations ?? []).map(migratePenaltyConfigurationRecord),
  });
  return { configuration: toPublicPenaltyConfiguration(removed) };
}

export function listPenaltyStenotypistCandidates(actor) {
  return listUsers()
    .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}

function normalizeImportText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeImportMatchKey(value) {
  return normalizeImportText(value)
    .toLocaleLowerCase('el-GR')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excelSerialToIso(serial) {
  const numeric = Number(serial);
  if (!Number.isFinite(numeric) || numeric < 20000 || numeric > 80000) return '';
  const utcDays = Math.floor(numeric);
  const date = new Date(Date.UTC(1899, 11, 30) + utcDays * 86400000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function expandTwoDigitYear(yearText) {
  const year = Number.parseInt(yearText, 10);
  if (!Number.isFinite(year)) return '';
  if (yearText.length === 4) return String(year);
  return String(year >= 70 ? 1900 + year : 2000 + year);
}

function normalizeImportValidityFrom(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromSerial = excelSerialToIso(value);
    if (fromSerial) return fromSerial;
  }

  const text = normalizeImportText(value);
  if (!text) return '';

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const fromSerial = excelSerialToIso(text);
    if (fromSerial) return fromSerial;
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

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

function getImportField(row, keys) {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);
  for (const key of keys) {
    const needle = normalizeImportMatchKey(key);
    const match = entries.find(([header]) => normalizeImportMatchKey(header) === needle);
    if (match) return match[1];
  }
  return '';
}

function normalizePenaltyImportRow(raw) {
  return {
    stenotypist: normalizeImportText(
      getImportField(raw, [
        'Stenotypist',
        'Stenotypist Name',
        'Full Name',
        'Name',
        'Alias',
        'Username',
      ]),
    ),
    targetHoursBeforeDeadline: getImportField(raw, [
      'Target Hours Before Deadline',
      'Target Hours',
      'Grace Period',
      'Grace Period [hours]',
      'Grace Period Hours',
    ]),
    penaltyPerHourLate: getImportField(raw, [
      'Penalty Per Hour Late',
      'Penalty Per Hour',
      'Extra Penalty Per Hour',
      'Extra Penalty Per Hour [€]',
    ]),
    validFrom: getImportField(raw, ['Validity From', 'Valid From', 'ValidityFrom', 'ValidFrom']),
  };
}

function findStenotypistForImport(label) {
  const raw = normalizeImportText(label);
  if (!raw) return null;

  const paren = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(raw);
  const namePart = normalizeImportMatchKey(paren ? paren[1] : raw);
  const usernamePart = normalizeImportMatchKey(paren ? paren[2] : '');
  const candidates = listUsers().filter(
    (user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'),
  );

  if (usernamePart) {
    const byUsername = candidates.find(
      (user) => normalizeImportMatchKey(user.username) === usernamePart,
    );
    if (byUsername) return byUsername;
  }

  const byExactUsername = candidates.find(
    (user) => normalizeImportMatchKey(user.username) === namePart,
  );
  if (byExactUsername) return byExactUsername;

  const byFullName = candidates.find(
    (user) => normalizeImportMatchKey(user.fullName) === namePart,
  );
  if (byFullName) return byFullName;

  return null;
}

/** Import penalty configurations from Excel. Match key: stenotypist + validityFrom. */
export function importPenaltyConfigurations(rows, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  list.forEach((raw, index) => {
    const rowNumber = index + 2;
    const row = normalizePenaltyImportRow(raw);
    if (
      !row.stenotypist &&
      !normalizeImportText(row.validFrom) &&
      !normalizeImportText(row.targetHoursBeforeDeadline) &&
      !normalizeImportText(row.penaltyPerHourLate)
    ) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: 'penaltyConfigurationImportRowEmpty' });
      return;
    }

    const stenotypist = findStenotypistForImport(row.stenotypist);
    if (!stenotypist) {
      summary.skipped += 1;
      summary.errors.push({
        row: rowNumber,
        message: 'penaltyConfigurationStenotypistInvalid',
        detail: row.stenotypist,
      });
      return;
    }

    const validFrom = normalizeImportValidityFrom(row.validFrom);
    if (!validFrom) {
      summary.skipped += 1;
      summary.errors.push({
        row: rowNumber,
        message: 'penaltyConfigurationValidFromRequired',
        detail: normalizeImportText(row.validFrom),
      });
      return;
    }

    const payload = {
      stenotypistUserId: stenotypist.id,
      targetHoursBeforeDeadline: row.targetHoursBeforeDeadline,
      penaltyPerHourLate: row.penaltyPerHourLate,
      validFrom,
    };

    const existing = (readPenaltyConfigurationsFile().configurations ?? [])
      .map(migratePenaltyConfigurationRecord)
      .find(
        (configuration) =>
          configuration.stenotypistUserId === stenotypist.id &&
          configuration.validFrom === validFrom,
      );

    if (existing) {
      const result = updatePenaltyConfigurationRecord(existing.id, payload, actor);
      if (result.errors) {
        summary.skipped += 1;
        summary.errors.push({ row: rowNumber, message: result.errors[0] });
        return;
      }
      summary.updated += 1;
      return;
    }

    const result = createPenaltyConfigurationRecord(payload, actor);
    if (result.errors) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: result.errors[0] });
      return;
    }
    summary.created += 1;
  });

  return summary;
}
