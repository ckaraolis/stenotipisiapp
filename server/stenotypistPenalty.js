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
import { listJobRecords } from './jobs.js';
import { findProjectRecordById } from './projects.js';
import { canAccessPenaltyConfigurationModule } from './permissions.js';
import { normalizeValidityFrom } from './travellingTimes.js';
import { resolveTravellingChargeEntryForDate } from './travellingCharges.js';

const PENALTY_CONFIG_PATH = path.join(DB_DIR, 'stenotypistPenaltyConfigurations.json');

/** §5.1 — Default penalty settings when no configuration exists. */
export const DEFAULT_PENALTY_GRACE_PERIOD_HOURS = 48;
export const DEFAULT_PENALTY_BASE_AMOUNT = 30;
export const DEFAULT_PENALTY_EXTRA_PER_HOUR = 2;

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

export function normalizePenaltyGracePeriodHours(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || !Number.isInteger(number)) {
    return null;
  }
  return number;
}

export function normalizePenaltyBaseAmount(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

export function normalizePenaltyExtraPerHour(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

function migratePenaltyConfigurationRecord(record) {
  const now = new Date().toISOString();
  return {
    id: record.id ?? generatePenaltyConfigurationId(),
    gracePeriodHours:
      normalizePenaltyGracePeriodHours(record.gracePeriodHours) ?? DEFAULT_PENALTY_GRACE_PERIOD_HOURS,
    basePenalty: normalizePenaltyBaseAmount(record.basePenalty) ?? DEFAULT_PENALTY_BASE_AMOUNT,
    extraPenaltyPerHour:
      normalizePenaltyExtraPerHour(record.extraPenaltyPerHour) ?? DEFAULT_PENALTY_EXTRA_PER_HOUR,
    validFrom: normalizeValidityFrom(record.validFrom ?? record.validityFrom),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureStenotypistPenaltyDatabase() {
  ensureCollectionFile('stenotypistPenaltyConfigurations', { configurations: [] });
}

function toPublicPenaltyConfiguration(record) {
  return {
    id: record.id,
    gracePeriodHours: record.gracePeriodHours,
    basePenalty: record.basePenalty,
    extraPenaltyPerHour: record.extraPenaltyPerHour,
    validFrom: record.validFrom,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function assertPenaltyConfigurationAccess(actor) {
  if (!canAccessPenaltyConfigurationModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function listAllPenaltyConfigurations() {
  return readPenaltyConfigurationsFile().configurations ?? [];
}

/**
 * §5.1 — Pick the penalty configuration valid for a job date.
 * Each entry is valid from its Valid From until the next Valid From.
 */
export function resolvePenaltyConfigurationEntryForDate(entries, jobDate) {
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

/** §5.1 — Resolve applicable penalty settings for a job date. */
export function resolvePenaltyConfigurationForDate(jobDate) {
  const entries = listAllPenaltyConfigurations();
  const resolved = resolvePenaltyConfigurationEntryForDate(entries, jobDate);
  if (resolved) {
    return {
      id: resolved.id,
      gracePeriodHours: resolved.gracePeriodHours,
      basePenalty: resolved.basePenalty,
      extraPenaltyPerHour: resolved.extraPenaltyPerHour,
      validFrom: resolved.validFrom,
      isDefault: false,
    };
  }

  return {
    id: null,
    gracePeriodHours: DEFAULT_PENALTY_GRACE_PERIOD_HOURS,
    basePenalty: DEFAULT_PENALTY_BASE_AMOUNT,
    extraPenaltyPerHour: DEFAULT_PENALTY_EXTRA_PER_HOUR,
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

  const settings = resolvePenaltyConfigurationForDate(job.date);
  const slaHours = slaToHours(getCustomerSlaForJob(job));
  const lateThresholdMs =
    jobEnd.getTime() +
    (slaHours + settings.gracePeriodHours) * 60 * 60 * 1000;

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

  const settings = resolvePenaltyConfigurationForDate(job.date);
  const serviceLevel = getCustomerSlaForJob(job);
  const slaHours = slaToHours(serviceLevel);
  const requiredSubmissionMs =
    jobEnd.getTime() + (slaHours + settings.gracePeriodHours) * 60 * 60 * 1000;
  const delayBeyondSlaHours = (submittedAt.getTime() - (jobEnd.getTime() + slaHours * 60 * 60 * 1000)) /
    (1000 * 60 * 60);
  const delayHours = Math.max(0, delayBeyondSlaHours - settings.gracePeriodHours);
  const extraPenalty = Math.round(delayHours * settings.extraPenaltyPerHour * 100) / 100;
  const totalPenalty = Math.round((settings.basePenalty + extraPenalty) * 100) / 100;

  return {
    serviceLevel,
    gracePeriodHours: settings.gracePeriodHours,
    basePenalty: settings.basePenalty,
    extraPenaltyPerHour: settings.extraPenaltyPerHour,
    jobEndDateTime: jobEnd.toISOString(),
    requiredSubmissionDateTime: new Date(requiredSubmissionMs).toISOString(),
    actualSubmissionDateTime: submittedAt.toISOString(),
    delayHours: Math.round(delayHours * 1000) / 1000,
    extraPenalty,
    totalPenalty,
  };
}

function isPenaltyConfigurationApplicableInRange(entry, allEntries, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  if (entry.validFrom > rangeTo) return false;

  const sorted = [...allEntries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const index = sorted.findIndex((row) => row.id === entry.id);
  const nextValidFrom = index >= 0 && index < sorted.length - 1 ? sorted[index + 1].validFrom : null;

  return !nextValidFrom || nextValidFrom > rangeFrom;
}

function filterPenaltyConfigurationsByApplicableDate(rows, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return rows;
  return rows.filter((row) => isPenaltyConfigurationApplicableInRange(row, rows, dateFrom, dateTo));
}

export function listPenaltyConfigurationRecords(actor, options = {}) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const dateFrom = normalizeValidityFrom(options.dateFrom);
  const dateTo = normalizeValidityFrom(options.dateTo);
  let rows = listAllPenaltyConfigurations();
  rows = filterPenaltyConfigurationsByApplicableDate(rows, dateFrom, dateTo);

  return {
    configurations: rows
      .map(toPublicPenaltyConfiguration)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
  };
}

export function findPenaltyConfigurationRecordById(configurationId, actor) {
  const denied = assertPenaltyConfigurationAccess(actor);
  if (denied) return denied;

  const record = listAllPenaltyConfigurations().find((row) => row.id === configurationId);
  if (!record) {
    return { errors: ['penaltyConfigurationNotFound'] };
  }

  return { configuration: toPublicPenaltyConfiguration(record) };
}

function validatePenaltyConfigurationInput(input, { existingId = null } = {}) {
  const errors = [];
  const gracePeriodHours = normalizePenaltyGracePeriodHours(input.gracePeriodHours);
  const basePenalty = normalizePenaltyBaseAmount(input.basePenalty);
  const extraPenaltyPerHour = normalizePenaltyExtraPerHour(input.extraPenaltyPerHour);
  const validFrom = normalizeValidityFrom(input.validFrom ?? input.validityFrom);

  if (gracePeriodHours === null) {
    errors.push('penaltyConfigurationGracePeriodInvalid');
  }

  if (basePenalty === null) {
    errors.push('penaltyConfigurationBasePenaltyInvalid');
  }

  if (extraPenaltyPerHour === null) {
    errors.push('penaltyConfigurationExtraPenaltyPerHourInvalid');
  }

  if (!validFrom) {
    errors.push('penaltyConfigurationValidFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const duplicate = listAllPenaltyConfigurations().find(
    (row) => row.id !== existingId && row.validFrom === validFrom,
  );
  if (duplicate) {
    return { errors: ['penaltyConfigurationValidFromDuplicate'] };
  }

  return {
    value: {
      gracePeriodHours,
      basePenalty,
      extraPenaltyPerHour,
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
    gracePeriodHours: validation.value.gracePeriodHours,
    basePenalty: validation.value.basePenalty,
    extraPenaltyPerHour: validation.value.extraPenaltyPerHour,
    validFrom: validation.value.validFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.configurations = [...(data.configurations ?? []), record];
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

  const updated = {
    ...data.configurations[index],
    gracePeriodHours: validation.value.gracePeriodHours,
    basePenalty: validation.value.basePenalty,
    extraPenaltyPerHour: validation.value.extraPenaltyPerHour,
    validFrom: validation.value.validFrom,
    updatedAt: new Date().toISOString(),
  };

  data.configurations[index] = updated;
  writePenaltyConfigurationsFile(data);
  return { configuration: toPublicPenaltyConfiguration(updated) };
}

/** §5.4 — Whether any job resolves to this penalty configuration on its date. */
export function isPenaltyConfigurationReferencedByJob(configuration) {
  if (!configuration) return false;

  const entries = listAllPenaltyConfigurations();
  return listJobRecords(null).some((job) => {
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

  const configuration = data.configurations[index];
  if (isPenaltyConfigurationReferencedByJob(configuration)) {
    return { errors: ['penaltyConfigurationReferencedByJob'] };
  }

  const [removed] = data.configurations.splice(index, 1);
  writePenaltyConfigurationsFile(data);
  return { configuration: toPublicPenaltyConfiguration(removed) };
}
