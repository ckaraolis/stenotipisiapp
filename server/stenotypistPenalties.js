import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUserById, listUsers } from './db.js';
import { listJobRecords } from './jobs.js';
import { hasPermission } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { buildTranscriptPenaltyDetails } from './stenotypistPenalty.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_PATH = path.join(__dirname, '..', 'database', 'jobSubmissions.json');

function readSubmissionsFile() {
  if (!fs.existsSync(SUBMISSIONS_PATH)) {
    return { submissions: [] };
  }
  return JSON.parse(fs.readFileSync(SUBMISSIONS_PATH, 'utf8'));
}

function normalizeIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function formatProjectLabel(job) {
  const parts = [job.projectField1, job.projectField2, job.projectField3, job.projectField4].filter(
    (part) => typeof part === 'string' && part.trim(),
  );
  return parts.length > 0 ? parts.join(' + ') : '—';
}

function getLatestSubmissionForJob(submissions, jobId) {
  return (
    submissions
      .filter((row) => row.jobId === jobId)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0] ?? null
  );
}

function assertPenaltiesListAccess(actor) {
  if (!hasPermission(actor, 'financials.stenotypist_penalties')) {
    return { errors: ['forbidden'] };
  }
  return null;
}

/** §5.6 — Stenotypists may only view their own penalty rows. */
export function isStenotypistPenaltiesSelfServiceOnly(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

function resolveStenotypistFilter(actor, requestedStenotypistUserId) {
  if (isStenotypistPenaltiesSelfServiceOnly(actor)) {
    return actor.id;
  }
  return typeof requestedStenotypistUserId === 'string' ? requestedStenotypistUserId.trim() : '';
}

/** §5.5 — Build penalty rows for jobs with late transcript submission. */
export function buildPenaltyRows({ actor = null, stenotypistUserId = '', dateFrom = '', dateTo = '' } = {}) {
  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  const submissions = readSubmissionsFile().submissions ?? [];
  const rows = [];

  for (const job of listJobRecords(actor)) {
    if (!job.stenotypistUserId?.trim()) continue;
    if (stenotypistUserId && job.stenotypistUserId !== stenotypistUserId) continue;
    if (!job.date || job.date < rangeFrom || job.date > rangeTo) continue;

    const submission = getLatestSubmissionForJob(submissions, job.id);
    const details = buildTranscriptPenaltyDetails(job, submission);
    if (!details) continue;

    rows.push({
      id: job.id,
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobDate: job.date,
      stenotypistUserId: job.stenotypistUserId,
      stenotypistFullName: job.stenotypistName ?? '',
      stenotypistUsername: job.stenotypistUsername ?? '',
      customerAlias: job.customerAlias ?? '',
      projectLabel: formatProjectLabel(job),
      jobEndTimeAdministrator: job.endTimeAdministrator ?? '',
      serviceLevel: details.serviceLevel,
      gracePeriodHours: details.gracePeriodHours,
      requiredSubmissionDateTime: details.requiredSubmissionDateTime,
      actualSubmissionDateTime: details.actualSubmissionDateTime,
      delayHours: details.delayHours,
      basePenalty: details.basePenalty,
      extraPenalty: details.extraPenalty,
      totalPenalty: details.totalPenalty,
    });
  }

  return rows.sort((a, b) => {
    if (a.jobDate !== b.jobDate) return a.jobDate.localeCompare(b.jobDate);
    return a.jobNumber.localeCompare(b.jobNumber);
  });
}

/** §5.5 — List jobs where a late-submission penalty applies. */
export function listPenaltyRecords(actor, options = {}) {
  const denied = assertPenaltiesListAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = resolveStenotypistFilter(actor, options.stenotypistUserId);
  const dateFrom = normalizeIsoDate(options.dateFrom);
  const dateTo = normalizeIsoDate(options.dateTo);

  return {
    penalties: buildPenaltyRows({
      actor,
      stenotypistUserId,
      dateFrom,
      dateTo,
    }),
  };
}

export function listPenaltiesStenotypistCandidates(actor) {
  const denied = assertPenaltiesListAccess(actor);
  if (denied) return denied;

  if (isStenotypistPenaltiesSelfServiceOnly(actor)) {
    const user = findUserById(actor.id);
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
