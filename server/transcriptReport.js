import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findJobById } from './jobs.js';
import { CHARACTERS_PER_PAGE_CONSTANT } from './jobMatrix.js';
import { canAccessTranscriptRecord } from './transcriptAccess.js';
import { readTranscriptFileBinary } from './transcriptFileStorage.js';
import { countBillableTranscriptCharacters } from './transcriptMetrics.js';
import {
  parseAccuracyFromSgxml,
  parseEditingHoursFromSgxml,
  parseTranDuration0HoursFromSgxml,
} from './transcriptSgxml.js';
import { computeStenotypingHoursFromTimestampsText } from './transcriptTimestamps.js';
import {
  findTranscriptRowById,
  readTranscriptRows,
  toPublicTranscript,
} from './transcripts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_PATH = path.join(__dirname, '..', 'database', 'jobSubmissions.json');

const PENDING_STATUS_BUCKETS = {
  completed: 'finished',
  edited: 'edited',
  inReview: 'in_review',
  approved: 'reviewed',
};

function readSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(SUBMISSIONS_PATH, 'utf8'));
  return data.submissions ?? [];
}

function getSubmissionForJob(jobId) {
  return readSubmissions().find((row) => row.jobId === jobId) ?? null;
}

function parseTimeToMinutes(value) {
  if (typeof value !== 'string' || !value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** §2.5 — Billed hours from stenotypist receipt times only. */
function getBilledHoursFromStenotypistTimes(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    return 0;
  }
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

function readStoredFileText(transcriptId, fileEntry) {
  if (!fileEntry?.storageId) return '';
  const buffer = readTranscriptFileBinary(transcriptId, fileEntry.storageId);
  if (!buffer) return '';
  return buffer.toString('utf8');
}

function resolveTranscriptPlainText(transcript, submission) {
  const bundled =
    typeof transcript.submission?.transcriptPlainText === 'string'
      ? transcript.submission.transcriptPlainText
      : '';
  if (bundled.trim()) return bundled;

  const cached =
    typeof submission?.transcriptPlainText === 'string' ? submission.transcriptPlainText : '';
  if (cached.trim()) return cached;

  const rawFile = transcript.files?.rawFiles?.transcript;
  return readStoredFileText(transcript.id, rawFile);
}

function resolveTimestampsText(transcript, submission) {
  const bundled =
    typeof transcript.submission?.transcriptTimestampsText === 'string'
      ? transcript.submission.transcriptTimestampsText
      : '';
  if (bundled.trim()) return bundled;

  const cached =
    typeof submission?.transcriptTimestampsText === 'string'
      ? submission.transcriptTimestampsText
      : '';
  if (cached.trim()) return cached;

  const rawFile = transcript.files?.rawFiles?.transcriptWithTimestamps;
  return readStoredFileText(transcript.id, rawFile);
}

function resolveSgxmlContent(transcript, submission) {
  if (typeof transcript.sgxmlContent === 'string' && transcript.sgxmlContent.trim()) {
    return transcript.sgxmlContent.trim();
  }
  if (typeof submission?.sgxmlContent === 'string' && submission.sgxmlContent.trim()) {
    return submission.sgxmlContent.trim();
  }

  const editedFiles = transcript.files?.editedRawFiles ?? [];
  const sgxmlFile =
    editedFiles.find((file) => /\.sgxml$/i.test(file.name)) ??
    editedFiles[editedFiles.length - 1] ??
    null;
  if (!sgxmlFile) return '';

  const text = readStoredFileText(transcript.id, sgxmlFile);
  if (text.trim()) return text;

  return '';
}

function computePageCount(transcriptPlainText, submission, transcriptSubmission = {}) {
  const explicitCount = Number(
    submission?.transcriptCharacterCount ?? transcriptSubmission?.transcriptCharacterCount,
  );
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return Math.round(explicitCount / CHARACTERS_PER_PAGE_CONSTANT);
  }
  if (transcriptPlainText.trim()) {
    const characters = countBillableTranscriptCharacters(transcriptPlainText);
    return Math.round(characters / CHARACTERS_PER_PAGE_CONSTANT);
  }
  return 0;
}

function computeReviewingHours(reviewStartTime, reviewEndTime) {
  if (!reviewStartTime || !reviewEndTime) return 0;
  const startMs = Date.parse(reviewStartTime);
  const endMs = Date.parse(reviewEndTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.round(((endMs - startMs) / (60 * 60 * 1000)) * 100) / 100;
}

function ratioPerUnit(numerator, denominator) {
  if (!denominator || !numerator) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function monthStartKey(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function isJobInCurrentMonth(job, monthStart) {
  if (!job?.date) return false;
  return job.date >= monthStart;
}

function isCompletedJobStatus(status) {
  return ['finished', 'edited', 'in_review', 'reviewed', 'published', 'reconciled', 'invoiced'].includes(
    status,
  );
}

function buildMonthTotalsForStenotypist(stenotypistUserId, allRows, referenceDate = new Date()) {
  const monthStart = monthStartKey(referenceDate);
  let totalStenotypingHours = 0;
  let totalBilledHours = 0;
  let totalPages = 0;

  const seenJobIds = new Set();

  for (const row of allRows) {
    if (row.stenotypistUserId !== stenotypistUserId) continue;

    const job = findJobById(row.jobId);
    if (!job || !isJobInCurrentMonth(job, monthStart) || !isCompletedJobStatus(job.status)) {
      continue;
    }
    if (seenJobIds.has(job.id)) continue;
    seenJobIds.add(job.id);

    const submission = getSubmissionForJob(job.id);
    const transcriptPlainText = resolveTranscriptPlainText(row, submission);
    const timestampsText = resolveTimestampsText(row, submission);

    totalPages += computePageCount(transcriptPlainText, submission, row.submission);
    totalBilledHours += getBilledHoursFromStenotypistTimes(
      row.startTimeStenotypist || job.startTimeStenotypist,
      row.endTimeStenotypist || job.endTimeStenotypist,
    );
    totalStenotypingHours += computeStenotypingHoursFromTimestampsText(timestampsText);
  }

  return {
    totalStenotypingHours: Math.round(totalStenotypingHours * 100) / 100,
    totalBilledHours: Math.round(totalBilledHours * 100) / 100,
    totalPages,
  };
}

function buildPendingTranscriptCounts(allRows) {
  const counts = {
    total: 0,
    completed: 0,
    edited: 0,
    inReview: 0,
    approved: 0,
  };

  for (const row of allRows) {
    const job = findJobById(row.jobId);
    const status = job?.status ?? '';
    if (status === PENDING_STATUS_BUCKETS.completed) {
      counts.completed += 1;
    } else if (status === PENDING_STATUS_BUCKETS.edited) {
      counts.edited += 1;
    } else if (status === PENDING_STATUS_BUCKETS.inReview) {
      counts.inReview += 1;
    } else if (status === PENDING_STATUS_BUCKETS.approved) {
      counts.approved += 1;
    } else {
      continue;
    }
    counts.total += 1;
  }

  return counts;
}

/** §2.5 — Compute transcript report metrics for a single transcript row. */
export function computeTranscriptReportMetrics(transcript, allRows) {
  const job = findJobById(transcript.jobId);
  const submission = getSubmissionForJob(transcript.jobId);
  const publicTranscript = toPublicTranscript(transcript, allRows);

  const transcriptPlainText = resolveTranscriptPlainText(transcript, submission);
  const timestampsText = resolveTimestampsText(transcript, submission);
  const sgxmlContent = resolveSgxmlContent(transcript, submission);

  const pages = computePageCount(transcriptPlainText, submission, transcript.submission);
  const billedHours = getBilledHoursFromStenotypistTimes(
    transcript.startTimeStenotypist || job?.startTimeStenotypist,
    transcript.endTimeStenotypist || job?.endTimeStenotypist,
  );
  const stenotypingHours = computeStenotypingHoursFromTimestampsText(timestampsText);
  const tranDuration0Hours = parseTranDuration0HoursFromSgxml(sgxmlContent);
  const stenotypingWithinSgxmlCap =
    tranDuration0Hours === null ? null : stenotypingHours <= tranDuration0Hours;

  const editing = parseEditingHoursFromSgxml(sgxmlContent);
  const editingHours = editing.hours;
  const reviewingHours = computeReviewingHours(transcript.reviewStartTime, transcript.reviewEndTime);
  const accuracyPercent = parseAccuracyFromSgxml(sgxmlContent);

  const showDeadline = publicTranscript.jobStatus !== 'published';
  const deadlineMinutes = showDeadline ? publicTranscript.deadlineMinutes : null;

  const monthTotals = buildMonthTotalsForStenotypist(transcript.stenotypistUserId, allRows);

  return {
    pages,
    billedHours,
    stenotypingHours,
    billedStenotypingLabel: `${billedHours.toFixed(1)}/${stenotypingHours.toFixed(1)}`,
    tranDuration0Hours,
    stenotypingWithinSgxmlCap,
    editingHours,
    editingHoursPerPage: ratioPerUnit(editingHours, pages),
    editingHoursPerBilledHour: ratioPerUnit(editingHours, billedHours),
    reviewingHours,
    reviewingHoursPerPage: ratioPerUnit(reviewingHours, pages),
    reviewingHoursPerBilledHour: ratioPerUnit(reviewingHours, billedHours),
    accuracyPercent,
    deadlineMinutes,
    showDeadline,
    monthStenotypistHours: monthTotals.totalStenotypingHours,
    monthBilledHours: monthTotals.totalBilledHours,
    monthPagesWritten: monthTotals.totalPages,
    monthStenotypistBilledLabel: `${monthTotals.totalStenotypingHours.toFixed(1)}/${monthTotals.totalBilledHours.toFixed(1)}`,
    monthPagesBilledLabel: `${monthTotals.totalPages}/${monthTotals.totalBilledHours.toFixed(1)}`,
    jobStatus: publicTranscript.jobStatus,
    isPublished: publicTranscript.status === 'published',
  };
}

export function buildTranscriptReport(transcriptId, actor) {
  const allRows = readTranscriptRows();
  const transcript = findTranscriptRowById(transcriptId, allRows);
  if (!transcript) {
    return { errors: ['transcriptNotFound'] };
  }
  if (!canAccessTranscriptRecord(actor, transcript, allRows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const metrics = computeTranscriptReportMetrics(transcript, allRows);
  const pendingTranscripts = buildPendingTranscriptCounts(allRows);

  return {
    report: {
      transcriptId: transcript.id,
      jobNumber: transcript.jobNumber,
      ...metrics,
      pendingTranscripts,
    },
  };
}
