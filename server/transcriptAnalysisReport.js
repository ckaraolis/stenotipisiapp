import { JOB_STATUSES, normalizeJobStatus } from './jobCatalog.js';
import { filterTranscriptsForActor } from './transcriptAccess.js';
import { computeTranscriptReportMetrics } from './transcriptReport.js';
import { getJobForTranscript } from './transcriptDetails.js';
import {
  getDefaultTranscriptDateRange,
  readTranscriptRows,
  toPublicTranscript,
} from './transcripts.js';

function normalizeDateKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

function normalizeJobStatusFilter(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return JOB_STATUSES.includes(status) ? status : '';
}

function formatEditDurationMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) return `${remainder}m`;
  if (remainder <= 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatDeadlineMinutes(minutes) {
  if (minutes === null || minutes === undefined) return '';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const formatted =
    hours > 0 ? `${hours}:${String(remainder).padStart(2, '0')}` : `0:${String(remainder).padStart(2, '0')}`;
  return minutes < 0 ? `-${formatted}` : formatted;
}

function buildAnalysisRow(transcript, allRows) {
  const publicTranscript = toPublicTranscript(transcript, allRows);
  const metrics = computeTranscriptReportMetrics(transcript, allRows);

  return {
    transcriptId: transcript.id,
    jobNumber: publicTranscript.jobNumber,
    jobStatus: publicTranscript.jobStatus,
    customerName: publicTranscript.customerName,
    projectNumber: publicTranscript.projectNumber,
    date: publicTranscript.date,
    time: publicTranscript.time,
    stenotypistAlias: publicTranscript.stenotypistAlias,
    stenotypistName: publicTranscript.stenotypistName,
    editorName: publicTranscript.editorName,
    reviewerName: publicTranscript.reviewerName,
    publisherName: publicTranscript.publisherName,
    expedite: publicTranscript.expedite,
    bypassApproval: publicTranscript.bypassApproval,
    jobEndTime: publicTranscript.jobEndTime || publicTranscript.endTimeStenotypist,
    serviceLevelAgreement: publicTranscript.serviceLevelAgreement,
    deadlineMinutes: publicTranscript.deadlineMinutes,
    deadlineLabel: formatDeadlineMinutes(publicTranscript.deadlineMinutes),
    eteMinutes: publicTranscript.eteMinutes,
    editDurationMinutes: publicTranscript.editDurationMinutes,
    editDurationLabel: formatEditDurationMinutes(publicTranscript.editDurationMinutes),
    transcriptOwners: (publicTranscript.transcriptOwnerLabels ?? []).join(', '),
    pages: metrics.pages,
    billedHours: metrics.billedHours,
    stenotypingHours: metrics.stenotypingHours,
    billedStenotypingLabel: metrics.billedStenotypingLabel,
    editingHours: metrics.editingHours,
    editingHoursPerPage: metrics.editingHoursPerPage,
    editingHoursPerBilledHour: metrics.editingHoursPerBilledHour,
    reviewingHours: metrics.reviewingHours,
    reviewingHoursPerPage: metrics.reviewingHoursPerPage,
    reviewingHoursPerBilledHour: metrics.reviewingHoursPerBilledHour,
    accuracyPercent: metrics.accuracyPercent,
    monthStenotypistHours: metrics.monthStenotypistHours,
    monthBilledHours: metrics.monthBilledHours,
    monthPagesWritten: metrics.monthPagesWritten,
    monthStenotypistBilledLabel: metrics.monthStenotypistBilledLabel,
    monthPagesBilledLabel: metrics.monthPagesBilledLabel,
  };
}

function buildFilterOptions(rows) {
  const customers = new Map();
  const statuses = new Set();

  for (const row of rows) {
    const publicRow = toPublicTranscript(row, rows);
    if (publicRow.customerId && publicRow.customerName) {
      customers.set(publicRow.customerId, publicRow.customerName);
    }
    if (publicRow.jobStatus) statuses.add(publicRow.jobStatus);
  }

  return {
    customers: [...customers.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}

/** §3 — Transcripts Analysis Report across all accessible transcripts. */
export function buildTranscriptsAnalysisReport(actor, options = {}) {
  const allRows = readTranscriptRows();
  let scoped = filterTranscriptsForActor(allRows, actor);

  const jobStatus = normalizeJobStatusFilter(options.jobStatus ?? options.status);
  const customerId = typeof options.customerId === 'string' ? options.customerId.trim() : '';
  const dateFrom = normalizeDateKey(options.dateFrom);
  const dateTo = normalizeDateKey(options.dateTo);
  const search = typeof options.search === 'string' ? options.search.trim().toLowerCase() : '';

  const filterOptions = buildFilterOptions(scoped);
  const suggestedDateRange = getDefaultTranscriptDateRange(scoped);

  if (jobStatus) {
    scoped = scoped.filter((row) => {
      const job = getJobForTranscript(row);
      return normalizeJobStatus(job?.status) === jobStatus;
    });
  }

  if (customerId) {
    scoped = scoped.filter((row) => row.customerId === customerId);
  }

  if (dateFrom) {
    scoped = scoped.filter((row) => row.date >= dateFrom);
  }

  if (dateTo) {
    scoped = scoped.filter((row) => row.date <= dateTo);
  }

  if (search) {
    scoped = scoped.filter((row) => {
      const publicRow = toPublicTranscript(row, scoped);
      const haystack = [
        publicRow.jobNumber,
        publicRow.customerName,
        publicRow.projectNumber,
        publicRow.stenotypistAlias,
        publicRow.stenotypistName,
        publicRow.editorName,
        publicRow.reviewerName,
        publicRow.publisherName,
        ...(publicRow.transcriptOwnerLabels ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const rows = scoped
    .map((row) => buildAnalysisRow(row, allRows))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.time.localeCompare(b.time) ||
        a.jobNumber.localeCompare(b.jobNumber),
    );

  return {
    rows,
    total: rows.length,
    filterOptions,
    suggestedDateRange,
  };
}
