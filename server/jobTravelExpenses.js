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
import { listUsers } from './db.js';
import { JOB_STATUS_PHASE, normalizeJobStatus } from './jobCatalog.js';
import { listJobRecords } from './jobs.js';
import { canAccessTravelExpenseListModule, isStenotypistTravelExpenseSelfServiceOnly } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { resolveTravelExpenseAmount } from './travelExpenses.js';

const JOB_TRAVEL_EXPENSES_PATH = path.join(DB_DIR, 'jobTravelExpenses.json');

/** §6.5 — Travel expense status options. */
export const TRAVEL_EXPENSE_STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
export const DEFAULT_TRAVEL_EXPENSE_STATUS = 'pending';

function readJobTravelExpensesFile() {
  ensureCollectionFile('jobTravelExpenses', { expenses: [] });
  return readCollection('jobTravelExpenses', { expenses: [] });
}

function writeJobTravelExpensesFile(data) {
  writeCollection('jobTravelExpenses', data);
}

function generateJobTravelExpenseId() {
  return `jte-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeTravelExpenseStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return TRAVEL_EXPENSE_STATUS_OPTIONS.includes(status) ? status : DEFAULT_TRAVEL_EXPENSE_STATUS;
}

function normalizeAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function migrateJobTravelExpenseRecord(record) {
  const now = new Date().toISOString();
  return {
    id: record.id ?? generateJobTravelExpenseId(),
    jobId: typeof record.jobId === 'string' ? record.jobId.trim() : '',
    amount: normalizeAmount(record.amount),
    status: normalizeTravelExpenseStatus(record.status),
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

export function ensureJobTravelExpensesDatabase() {
  ensureCollectionFile('jobTravelExpenses', { expenses: [] });
}

function assertTravelExpenseListAccess(actor) {
  if (!canAccessTravelExpenseListModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

/** §6.7 — Stenotypists may only view their own travel expense rows and cannot act. */
export function isTravelExpenseSelfServiceOnly(actor) {
  return isStenotypistTravelExpenseSelfServiceOnly(actor);
}

function canApproveOrRejectTravelExpense(actor) {
  if (isTravelExpenseSelfServiceOnly(actor)) {
    return false;
  }
  const roles = normalizeRoles(actor);
  return roles.includes('super_admin') || roles.includes('manager');
}

function resolveStenotypistFilter(actor, requestedStenotypistUserId) {
  if (isTravelExpenseSelfServiceOnly(actor)) {
    return actor.id;
  }
  return typeof requestedStenotypistUserId === 'string' ? requestedStenotypistUserId.trim() : '';
}

function isCompletedJobStatus(status) {
  return JOB_STATUS_PHASE[normalizeJobStatus(status)] === 'completed';
}

function formatProjectLabel(job) {
  const parts = [job.projectField1, job.projectField2, job.projectField3, job.projectField4].filter(
    (part) => typeof part === 'string' && part.trim(),
  );
  return parts.length > 0 ? parts.join(' + ') : '—';
}

function calculateAmountForJob(job) {
  if (!job?.stenotypistUserId || !job?.districtId || !job?.date) {
    return 0;
  }
  const amount = resolveTravelExpenseAmount(job.stenotypistUserId, job.districtId, job.date);
  return amount === null ? 0 : normalizeAmount(amount);
}

/** §6.5 — Ensure a travel expense row exists for a completed job. */
function ensureExpenseForJob(job) {
  const data = readJobTravelExpensesFile();
  const existing = (data.expenses ?? []).find((row) => row.jobId === job.id);
  const calculatedAmount = calculateAmountForJob(job);
  const now = new Date().toISOString();

  if (!existing) {
    const record = {
      id: generateJobTravelExpenseId(),
      jobId: job.id,
      amount: calculatedAmount,
      status: DEFAULT_TRAVEL_EXPENSE_STATUS,
      createdAt: now,
      updatedAt: now,
    };
    data.expenses = [...(data.expenses ?? []), record];
    writeJobTravelExpensesFile(data);
    return record;
  }

  if (existing.status === 'pending' && existing.amount !== calculatedAmount) {
    const updated = {
      ...existing,
      amount: calculatedAmount,
      updatedAt: now,
    };
    data.expenses = data.expenses.map((row) => (row.id === existing.id ? updated : row));
    writeJobTravelExpensesFile(data);
    return updated;
  }

  return existing;
}

function toPublicJobTravelExpense(job, expense) {
  return {
    id: expense.id,
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobDate: job.date,
    stenotypistUserId: job.stenotypistUserId ?? '',
    stenotypistFullName: job.stenotypistName ?? '',
    stenotypistUsername: job.stenotypistUsername ?? '',
    projectDistrictId: job.districtId ?? '',
    projectDistrictName: job.districtName ?? '',
    projectDistrictAlias: job.districtAlias ?? '',
    customerAlias: job.customerAlias ?? '',
    projectLabel: formatProjectLabel(job),
    amount: expense.amount,
    status: expense.status,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

/** §6.6 — List completed jobs with travel expense data for approval. */
export function buildJobTravelExpenseRows({
  actor = null,
  stenotypistUserId = '',
  dateFrom = '',
  dateTo = '',
  status = '',
} = {}) {
  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  const statusFilter =
    typeof status === 'string' && status.trim() ? normalizeTravelExpenseStatus(status) : '';

  const rows = [];
  for (const job of listJobRecords(actor)) {
    if (!isCompletedJobStatus(job.status)) continue;
    if (!job.stenotypistUserId?.trim()) continue;
    if (stenotypistUserId && job.stenotypistUserId !== stenotypistUserId) continue;
    if (!job.date || job.date < rangeFrom || job.date > rangeTo) continue;

    const expense = ensureExpenseForJob(job);
    if (statusFilter && expense.status !== statusFilter) continue;
    rows.push(toPublicJobTravelExpense(job, expense));
  }

  return rows.sort((a, b) => {
    if (a.jobDate !== b.jobDate) return a.jobDate.localeCompare(b.jobDate);
    return a.jobNumber.localeCompare(b.jobNumber);
  });
}

/** §6.6 — List completed jobs with travel expense data for approval. */
export function listJobTravelExpenseRecords(actor, options = {}) {
  const denied = assertTravelExpenseListAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = resolveStenotypistFilter(actor, options.stenotypistUserId);
  const dateFrom = normalizeIsoDate(options.dateFrom);
  const dateTo = normalizeIsoDate(options.dateTo);
  const status =
    typeof options.status === 'string' && options.status.trim()
      ? normalizeTravelExpenseStatus(options.status)
      : '';

  return {
    expenses: buildJobTravelExpenseRows({
      actor,
      stenotypistUserId,
      dateFrom,
      dateTo,
      status,
    }),
  };
}

function setTravelExpenseStatus(jobId, nextStatus, actor) {
  const denied = assertTravelExpenseListAccess(actor);
  if (denied) return denied;

  if (!canApproveOrRejectTravelExpense(actor)) {
    return { errors: ['forbidden'] };
  }

  const jobs = listJobRecords(actor);
  const job = jobs.find((row) => row.id === jobId);
  if (!job || !isCompletedJobStatus(job.status)) {
    return { errors: ['jobTravelExpenseNotFound'] };
  }

  const expense = ensureExpenseForJob(job);
  if (expense.status !== 'pending') {
    return { errors: ['jobTravelExpenseNotPending'] };
  }

  const data = readJobTravelExpensesFile();
  const index = (data.expenses ?? []).findIndex((row) => row.id === expense.id);
  if (index === -1) {
    return { errors: ['jobTravelExpenseNotFound'] };
  }

  const updated = {
    ...data.expenses[index],
    amount: calculateAmountForJob(job),
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
  data.expenses[index] = updated;
  writeJobTravelExpensesFile(data);

  return { expense: toPublicJobTravelExpense(job, updated) };
}

/** §6.6 — Approve travel expense payment. */
export function approveJobTravelExpense(jobId, actor) {
  return setTravelExpenseStatus(jobId, 'approved', actor);
}

/** §6.6 — Reject travel expense payment. */
export function rejectJobTravelExpense(jobId, actor) {
  return setTravelExpenseStatus(jobId, 'rejected', actor);
}

/** Find public job travel expense by job id (for audit before-snapshots). */
export function findJobTravelExpenseRecordByJobId(jobId, actor) {
  const denied = assertTravelExpenseListAccess(actor);
  if (denied) return denied;

  const jobs = listJobRecords(null);
  const job = jobs.find((row) => row.id === jobId);
  if (!job || !isCompletedJobStatus(job.status)) {
    return { errors: ['jobTravelExpenseNotFound'] };
  }

  if (isTravelExpenseSelfServiceOnly(actor) && job.stenotypistUserId !== actor.id) {
    return { errors: ['forbidden'] };
  }

  const data = readJobTravelExpensesFile();
  const expense = (data.expenses ?? []).find((row) => row.jobId === jobId);
  if (!expense) {
    return { errors: ['jobTravelExpenseNotFound'] };
  }

  return { expense: toPublicJobTravelExpense(job, expense) };
}

export function listJobTravelExpenseStenotypistCandidates(actor) {
  const denied = assertTravelExpenseListAccess(actor);
  if (denied) return denied;

  if (isTravelExpenseSelfServiceOnly(actor)) {
    const user = listUsers().find((row) => row.id === actor.id);
    return {
      candidates: user
        ? [{ id: user.id, fullName: user.fullName, username: user.username }]
        : [],
    };
  }

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
