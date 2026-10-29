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
import { findProjectRecordById } from './projects.js';
import { findJobById, patchJobFromTranscriptDetails, toPublicJob } from './jobs.js';
import { isJobStatusBefore } from './jobCatalog.js';
import { findUserById, listUsers } from './db.js';
import {
  canAccessTranscriptRecord,
  canEditTranscriptDetails,
  filterTranscriptsForActor,
  getTranscriptViewScope,
} from './transcriptAccess.js';
import { parseEditDurationFromSgxml } from './transcriptSgxml.js';
import {
  computeTranscriptEteMinutes,
  getTranscriptPageCountForJob,
} from './transcriptMetrics.js';
import { JOB_STATUSES, normalizeJobStatus } from './jobCatalog.js';
import {
  enrichTranscriptWithJobContext,
  getJobForTranscript,
  isValidTranscriptParticipant,
  isValidTranscriptPublisher,
  listTranscriptParticipantCandidates,
  listTranscriptPublisherCandidates,
  notifyTranscriptEditorAssigned,
  notifyTranscriptReviewerAssigned,
  propagateProjectEditorAssignment,
} from './transcriptDetails.js';

const TRANSCRIPTS_PATH = path.join(DB_DIR, 'transcripts.json');

export const TRANSCRIPT_STATUS_OPTIONS = ['finished', 'published'];
export const TRANSCRIPT_TYPE_OPTIONS = ['steno', 'audio'];

function readTranscriptsFile() {
  ensureCollectionFile('transcripts', { transcripts: [] });
  return readCollection('transcripts', { transcripts: [] });
}

function writeTranscriptsFile(data) {
  writeCollection('transcripts', data);
}

export function ensureTranscriptsDatabase() {
  ensureCollectionFile('transcripts', { transcripts: [] });
}

export function findTranscriptByJobId(jobId) {
  if (!jobId) return null;
  return readTranscriptRows().find((row) => row.jobId === jobId) ?? null;
}

function normalizeTranscriptType(value) {
  const type = typeof value === 'string' ? value.trim() : '';
  return TRANSCRIPT_TYPE_OPTIONS.includes(type) ? type : 'steno';
}

function normalizeTranscriptStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return TRANSCRIPT_STATUS_OPTIONS.includes(status) ? status : 'finished';
}

function emptyTranscriptFiles() {
  return {
    rawFiles: {
      rawZip: null,
      transcriptWithTimestamps: null,
      transcript: null,
    },
    attachmentFiles: {
      personalDictionary: null,
      evidenceList: null,
    },
    otherFiles: [],
    editedRawFiles: [],
    reviewedRawFiles: [],
    approvedTranscriptFile: null,
  };
}

function createEmptyTranscriptWorkflowFields() {
  return {
    editorUserId: '',
    editorName: '',
    editorRemarks: '',
    reviewerUserId: '',
    reviewerName: '',
    reviewerRemarks: '',
    publisherUserId: '',
    publisherName: '',
    publisherRemarks: '',
    editDurationMinutes: 0,
    editDurationSegments: [],
    sgxmlContent: '',
    reviewStartTime: '',
    reviewEndTime: '',
    bypassApproval: false,
    specialNotes: '',
  };
}

function normalizeFileVersion(file) {
  if (!file || typeof file !== 'object') return null;
  if (typeof file.name !== 'string' || !file.name.trim()) return null;
  return {
    id: typeof file.id === 'string' ? file.id : `ver-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name.trim(),
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : 0,
    type: typeof file.type === 'string' ? file.type : '',
    uploadedAt: typeof file.uploadedAt === 'string' ? file.uploadedAt : '',
    uploadedByUserId: typeof file.uploadedByUserId === 'string' ? file.uploadedByUserId : null,
    description: typeof file.description === 'string' ? file.description.trim() : '',
    storageId: typeof file.storageId === 'string' ? file.storageId : '',
  };
}

function normalizeFileEntry(file) {
  if (!file || typeof file !== 'object') return null;
  if (typeof file.name !== 'string' || !file.name.trim()) return null;
  return {
    id: typeof file.id === 'string' && file.id.trim() ? file.id.trim() : `file-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name.trim(),
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : 0,
    type: typeof file.type === 'string' ? file.type : '',
    uploadedAt: typeof file.uploadedAt === 'string' ? file.uploadedAt : '',
    description: typeof file.description === 'string' ? file.description.trim() : '',
    storageId: typeof file.storageId === 'string' ? file.storageId : '',
    history: Array.isArray(file.history)
      ? file.history.map(normalizeFileVersion).filter(Boolean)
      : [],
  };
}

function normalizeFileList(files) {
  if (!Array.isArray(files)) return [];
  return files.map(normalizeFileEntry).filter(Boolean);
}

function normalizeTranscriptFiles(input, submission = {}) {
  const files = emptyTranscriptFiles();
  const source = input && typeof input === 'object' ? input : {};
  const submissionRaw = submission.rawFiles ?? {};
  const submissionAttachments = submission.attachmentFiles ?? {};

  const rawSource = source.rawFiles ?? submissionRaw;
  files.rawFiles = {
    rawZip: normalizeFileEntry(rawSource.rawZip),
    transcriptWithTimestamps: normalizeFileEntry(rawSource.transcriptWithTimestamps),
    transcript: normalizeFileEntry(rawSource.transcript),
  };

  const attachmentSource = source.attachmentFiles ?? submissionAttachments;
  files.attachmentFiles = {
    personalDictionary: normalizeFileEntry(attachmentSource.personalDictionary),
    evidenceList: normalizeFileEntry(attachmentSource.evidenceList),
  };

  files.otherFiles = normalizeFileList(source.otherFiles ?? submission.otherFiles);
  files.editedRawFiles = normalizeFileList(source.editedRawFiles);
  files.reviewedRawFiles = normalizeFileList(source.reviewedRawFiles);
  files.approvedTranscriptFile = normalizeFileEntry(source.approvedTranscriptFile);

  return files;
}

function resolveTranscriptOwnerLabels(ownerIds = []) {
  return ownerIds
    .map((ownerId) => {
      const user = findUserById(ownerId);
      return user?.username || user?.fullName || '';
    })
    .filter(Boolean);
}

export function getDefaultTranscriptDateRange(rows = []) {
  const notEdited = rows.filter((row) => {
    const job = getJobForTranscript(row);
    const status = job?.status ?? '';
    return isJobStatusBefore(status, 'edited');
  });
  const notPublished = rows.filter((row) => {
    const job = getJobForTranscript(row);
    return job?.status !== 'published';
  });

  const fromDates = notEdited.map((row) => row.date).filter(Boolean).sort();
  const toDates = notPublished.map((row) => row.date).filter(Boolean).sort();

  if (fromDates.length === 0 || toDates.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { dateFrom: today, dateTo: today };
  }

  return {
    dateFrom: fromDates[0],
    dateTo: toDates[toDates.length - 1],
  };
}

function resolveParticipant(userId, name) {
  const trimmedId = typeof userId === 'string' ? userId.trim() : '';
  if (!trimmedId) {
    return { userId: '', name: typeof name === 'string' ? name.trim() : '' };
  }
  const user = findUserById(trimmedId);
  return {
    userId: trimmedId,
    name: user?.fullName || user?.username || (typeof name === 'string' ? name.trim() : ''),
  };
}

function migrateTranscriptRecord(transcript) {
  const workflow = createEmptyTranscriptWorkflowFields();
  const submission = transcript.submission ?? {};

  return {
    ...transcript,
    ...workflow,
    editorUserId: transcript.editorUserId ?? '',
    editorName: transcript.editorName ?? '',
    editorRemarks: transcript.editorRemarks ?? '',
    reviewerUserId: transcript.reviewerUserId ?? '',
    reviewerName: transcript.reviewerName ?? '',
    reviewerRemarks: transcript.reviewerRemarks ?? '',
    publisherUserId: transcript.publisherUserId ?? '',
    publisherName: transcript.publisherName ?? '',
    publisherRemarks: transcript.publisherRemarks ?? '',
    editDurationMinutes: Number(transcript.editDurationMinutes) || 0,
    editDurationSegments: Array.isArray(transcript.editDurationSegments)
      ? transcript.editDurationSegments
      : [],
    sgxmlContent: typeof transcript.sgxmlContent === 'string' ? transcript.sgxmlContent : '',
    reviewStartTime: transcript.reviewStartTime ?? '',
    reviewEndTime: transcript.reviewEndTime ?? '',
    bypassApproval: transcript.bypassApproval === true,
    specialNotes: typeof transcript.specialNotes === 'string' ? transcript.specialNotes : '',
    files: normalizeTranscriptFiles(transcript.files, submission),
    submission,
  };
}

export function readTranscriptRows() {
  const data = readTranscriptsFile();
  return (data.transcripts ?? []).map(migrateTranscriptRecord);
}

export function writeTranscriptRows(rows) {
  writeTranscriptsFile({ transcripts: rows });
}

export function findTranscriptRowById(transcriptId, rows = readTranscriptRows()) {
  if (!transcriptId) return null;
  return rows.find((row) => row.id === transcriptId) ?? null;
}

function transcriptHasRawData(files) {
  const raw = files?.rawFiles ?? {};
  return Boolean(raw.rawZip || raw.transcriptWithTimestamps || raw.transcript);
}

export function toPublicTranscript(transcript, allRows = readTranscriptRows()) {
  const row = migrateTranscriptRecord(transcript);
  const stenotypist = findUserById(row.stenotypistUserId);
  const editor = resolveParticipant(row.editorUserId, row.editorName);
  const reviewer = resolveParticipant(row.reviewerUserId, row.reviewerName);
  const publisher = resolveParticipant(row.publisherUserId, row.publisherName);
  const job = getJobForTranscript(row);
  const jobContext = enrichTranscriptWithJobContext(row, job);
  const pageCount = getTranscriptPageCountForJob(row.jobId);
  const eteMinutes = computeTranscriptEteMinutes(pageCount);

  return {
    id: row.id,
    jobId: row.jobId,
    jobNumber: row.jobNumber,
    type: row.type,
    status: row.status,
    customerId: row.customerId,
    customerName: row.customerName,
    projectId: row.projectId,
    projectNumber: row.projectNumber,
    date: row.date,
    time: row.time,
    stenotypistUserId: row.stenotypistUserId,
    stenotypistName: row.stenotypistName,
    stenotypistAlias: stenotypist?.username ?? '',
    expedite: row.expedite,
    receiptNumberStenotypist: row.receiptNumberStenotypist,
    startTimeStenotypist: row.startTimeStenotypist,
    endTimeStenotypist: row.endTimeStenotypist,
    transcriptOwnerIds: row.transcriptOwnerIds ?? [],
    transcriptOwnerLabels: resolveTranscriptOwnerLabels(row.transcriptOwnerIds ?? []),
    pageCount,
    eteMinutes,
    editorUserId: editor.userId,
    editorName: editor.name,
    editorRemarks: row.editorRemarks ?? '',
    reviewerUserId: reviewer.userId,
    reviewerName: reviewer.name,
    reviewerRemarks: row.reviewerRemarks ?? '',
    publisherUserId: publisher.userId,
    publisherName: publisher.name,
    publisherRemarks: row.publisherRemarks ?? '',
    editDurationMinutes: row.editDurationMinutes ?? 0,
    editDurationSegments: row.editDurationSegments ?? [],
    reviewStartTime: row.reviewStartTime ?? '',
    reviewEndTime: row.reviewEndTime ?? '',
    files: row.files,
    bypassApproval: row.bypassApproval === true,
    specialNotes: row.specialNotes ?? '',
    jobStatus: jobContext.jobStatus,
    serviceLevelAgreement: jobContext.serviceLevelAgreement,
    deadlineMinutes: jobContext.deadlineMinutes,
    jobEndTime: jobContext.jobEndTime || row.endTimeStenotypist,
    submission: row.submission,
    hasRawData: transcriptHasRawData(row.files),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listTranscriptRecords() {
  return readTranscriptRows()
    .map(toPublicTranscript)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.time.localeCompare(b.time) ||
        a.jobNumber.localeCompare(b.jobNumber),
    );
}

function normalizeTranscriptTypeFilter(value) {
  const type = typeof value === 'string' ? value.trim() : '';
  return TRANSCRIPT_TYPE_OPTIONS.includes(type) ? type : '';
}

function normalizeTranscriptStatusFilter(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return TRANSCRIPT_STATUS_OPTIONS.includes(status) ? status : '';
}

function normalizeDateKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeJobStatusFilter(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return JOB_STATUSES.includes(status) ? status : '';
}

function normalizeSortKey(value) {
  const allowed = new Set([
    'jobNumber',
    'date',
    'jobStatus',
    'customerName',
    'projectNumber',
    'stenotypistName',
    'editorName',
    'reviewerName',
    'publisherName',
    'eteMinutes',
    'deadlineMinutes',
  ]);
  const key = typeof value === 'string' ? value.trim() : '';
  return allowed.has(key) ? key : 'date';
}

function normalizeSortDirection(value) {
  return value === 'asc' ? 'asc' : 'desc';
}

function sortTranscripts(rows, sortBy = 'date', sortDirection = 'desc') {
  const factor = sortDirection === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const publicA = toPublicTranscript(a, rows);
    const publicB = toPublicTranscript(b, rows);
    let comparison = 0;
    switch (sortBy) {
      case 'jobNumber':
        comparison = publicA.jobNumber.localeCompare(publicB.jobNumber, undefined, { numeric: true });
        break;
      case 'jobStatus':
        comparison = publicA.jobStatus.localeCompare(publicB.jobStatus);
        break;
      case 'customerName':
        comparison = publicA.customerName.localeCompare(publicB.customerName);
        break;
      case 'projectNumber':
        comparison = publicA.projectNumber.localeCompare(publicB.projectNumber);
        break;
      case 'stenotypistName':
        comparison = publicA.stenotypistName.localeCompare(publicB.stenotypistName);
        break;
      case 'editorName':
        comparison = publicA.editorName.localeCompare(publicB.editorName);
        break;
      case 'reviewerName':
        comparison = publicA.reviewerName.localeCompare(publicB.reviewerName);
        break;
      case 'publisherName':
        comparison = publicA.publisherName.localeCompare(publicB.publisherName);
        break;
      case 'eteMinutes':
        comparison = publicA.eteMinutes - publicB.eteMinutes;
        break;
      case 'deadlineMinutes':
        comparison = (publicA.deadlineMinutes ?? 0) - (publicB.deadlineMinutes ?? 0);
        break;
      case 'date':
      default:
        comparison =
          publicA.date.localeCompare(publicB.date) ||
          publicA.time.localeCompare(publicB.time) ||
          publicA.jobNumber.localeCompare(publicB.jobNumber, undefined, { numeric: true });
        break;
    }
    return comparison * factor;
  });
}

function buildFilterOptions(transcripts) {
  const customers = new Map();
  const projects = new Map();
  const stenotypists = new Map();
  const editors = new Map();
  const reviewers = new Map();
  const transcriptOwners = new Map();
  const statuses = new Set();

  for (const transcript of transcripts) {
    const publicRow = toPublicTranscript(transcript, transcripts);
    if (publicRow.jobStatus) statuses.add(publicRow.jobStatus);
    if (transcript.customerId && transcript.customerName) {
      customers.set(transcript.customerId, transcript.customerName);
    }
    if (transcript.projectId && transcript.projectNumber) {
      projects.set(transcript.projectId, {
        id: transcript.projectId,
        label: transcript.projectNumber,
        customerId: transcript.customerId,
      });
    }
    if (transcript.stenotypistUserId) {
      stenotypists.set(transcript.stenotypistUserId, {
        id: transcript.stenotypistUserId,
        name: transcript.stenotypistName,
        alias: findUserById(transcript.stenotypistUserId)?.username ?? '',
      });
    }
    if (transcript.editorUserId) {
      editors.set(transcript.editorUserId, {
        id: transcript.editorUserId,
        name: transcript.editorName,
      });
    }
    if (transcript.reviewerUserId) {
      reviewers.set(transcript.reviewerUserId, {
        id: transcript.reviewerUserId,
        name: transcript.reviewerName,
      });
    }
    for (const ownerId of transcript.transcriptOwnerIds ?? []) {
      const user = findUserById(ownerId);
      transcriptOwners.set(ownerId, {
        id: ownerId,
        name: user?.fullName || user?.username || ownerId,
        alias: user?.username ?? '',
      });
    }
  }

  return {
    customers: [...customers.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    projects: [...projects.values()].sort((a, b) => a.label.localeCompare(b.label)),
    stenotypists: [...stenotypists.values()].sort((a, b) =>
      (a.name || a.alias).localeCompare(b.name || b.alias),
    ),
    editors: [...editors.values()].sort((a, b) => a.name.localeCompare(b.name)),
    reviewers: [...reviewers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    transcriptOwners: [...transcriptOwners.values()].sort((a, b) =>
      (a.alias || a.name).localeCompare(b.alias || b.name),
    ),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}

export function findTranscriptRecordById(transcriptId) {
  if (!transcriptId) return null;
  const transcript = readTranscriptRows().find((row) => row.id === transcriptId) ?? null;
  return transcript ? toPublicTranscript(transcript) : null;
}

export function getTranscriptForActor(transcriptId, actor) {
  if (!transcriptId) {
    return { errors: ['transcriptNotFound'] };
  }
  const rows = readTranscriptRows();
  const transcript = rows.find((row) => row.id === transcriptId) ?? null;
  if (!transcript) {
    return { errors: ['transcriptNotFound'] };
  }
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }
  return { transcript: toPublicTranscript(transcript, rows) };
}

export {
  listTranscriptParticipantCandidates,
  listTranscriptPublisherCandidates,
};

function applyParticipantPatch(target, prefix, input) {
  const userIdKey = `${prefix}UserId`;
  const nameKey = `${prefix}Name`;
  const remarksKey = `${prefix}Remarks`;

  if (Object.prototype.hasOwnProperty.call(input, userIdKey)) {
    const participant = resolveParticipant(input[userIdKey], input[nameKey] ?? target[nameKey]);
    target[userIdKey] = participant.userId;
    target[nameKey] = participant.name;
  } else if (Object.prototype.hasOwnProperty.call(input, nameKey)) {
    target[nameKey] = typeof input[nameKey] === 'string' ? input[nameKey].trim() : '';
  }

  if (Object.prototype.hasOwnProperty.call(input, remarksKey)) {
    target[remarksKey] = typeof input[remarksKey] === 'string' ? input[remarksKey].trim() : '';
  }
}

/** §2.1 / §2.2 — Update transcript workflow and metadata from the details form. */
export function updateTranscriptRecord(transcriptId, input, actor) {
  if (!canEditTranscriptDetails(actor)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) {
    return { errors: ['transcriptNotFound'] };
  }

  const existing = rows[index];
  if (!canAccessTranscriptRecord(actor, existing, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const previousEditorUserId = existing.editorUserId ?? '';
  const previousReviewerUserId = existing.reviewerUserId ?? '';
  const messages = [];

  const next = migrateTranscriptRecord({ ...existing });

  if (Object.prototype.hasOwnProperty.call(input, 'editorUserId')) {
    const editorId = typeof input.editorUserId === 'string' ? input.editorUserId.trim() : '';
    if (editorId && !isValidTranscriptParticipant(editorId)) {
      return { errors: ['transcriptEditorInvalid'] };
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'reviewerUserId')) {
    const reviewerId = typeof input.reviewerUserId === 'string' ? input.reviewerUserId.trim() : '';
    if (reviewerId && !isValidTranscriptParticipant(reviewerId)) {
      return { errors: ['transcriptReviewerInvalid'] };
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'publisherUserId')) {
    const publisherId = typeof input.publisherUserId === 'string' ? input.publisherUserId.trim() : '';
    if (publisherId && !isValidTranscriptPublisher(publisherId)) {
      return { errors: ['transcriptPublisherInvalid'] };
    }
  }

  applyParticipantPatch(next, 'editor', input);
  applyParticipantPatch(next, 'reviewer', input);
  applyParticipantPatch(next, 'publisher', input);

  if (Object.prototype.hasOwnProperty.call(input, 'reviewStartTime')) {
    next.reviewStartTime =
      typeof input.reviewStartTime === 'string' ? input.reviewStartTime.trim() : '';
  }
  if (Object.prototype.hasOwnProperty.call(input, 'reviewEndTime')) {
    next.reviewEndTime =
      typeof input.reviewEndTime === 'string' ? input.reviewEndTime.trim() : '';
  }
  if (Object.prototype.hasOwnProperty.call(input, 'bypassApproval')) {
    next.bypassApproval = input.bypassApproval === true;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'specialNotes')) {
    next.specialNotes =
      typeof input.specialNotes === 'string' ? input.specialNotes.trim().slice(0, 4000) : '';
  }

  if (input.files && typeof input.files === 'object') {
    next.files = normalizeTranscriptFiles(
      {
        ...next.files,
        ...input.files,
        rawFiles: { ...next.files.rawFiles, ...(input.files.rawFiles ?? {}) },
        attachmentFiles: {
          ...next.files.attachmentFiles,
          ...(input.files.attachmentFiles ?? {}),
        },
      },
      next.submission,
    );
  }

  if (typeof input.sgxmlContent === 'string' && input.sgxmlContent.trim()) {
    const parsed = parseEditDurationFromSgxml(input.sgxmlContent);
    next.editDurationMinutes = parsed.totalMinutes;
    next.editDurationSegments = parsed.segments;
  } else if (Object.prototype.hasOwnProperty.call(input, 'editDurationMinutes')) {
    const minutes = Number(input.editDurationMinutes);
    next.editDurationMinutes = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
  }

  let jobPatch = null;
  if (Object.prototype.hasOwnProperty.call(input, 'expedite')) {
    const expedite = input.expedite === true;
    next.expedite = expedite;
    jobPatch = { ...(jobPatch ?? {}), expedite };
  }

  const reviewerFirstAssignment =
    !previousReviewerUserId && Boolean(next.reviewerUserId?.trim());
  const reviewerReassigned =
    Boolean(previousReviewerUserId) &&
    Boolean(next.reviewerUserId?.trim()) &&
    previousReviewerUserId !== next.reviewerUserId;

  if (reviewerFirstAssignment) {
    jobPatch = { ...(jobPatch ?? {}), status: 'in_review' };
    messages.push('transcriptReviewerAssignedFirst');
  } else if (reviewerReassigned) {
    messages.push('transcriptReviewerReassigned');
  }

  if (previousEditorUserId !== (next.editorUserId ?? '') && next.editorUserId?.trim()) {
    messages.push('transcriptEditorAssigned');
  }

  next.updatedAt = new Date().toISOString();
  rows[index] = next;

  if (previousEditorUserId !== (next.editorUserId ?? '') && next.editorUserId?.trim()) {
    propagateProjectEditorAssignment(rows, next);
  }

  writeTranscriptRows(rows);

  if (jobPatch) {
    const jobResult = patchJobFromTranscriptDetails(next.jobId, jobPatch, actor);
    if (jobResult.errors) {
      return jobResult;
    }
  }

  const publicTranscript = toPublicTranscript(next, rows);

  if (previousEditorUserId !== next.editorUserId && next.editorUserId) {
    notifyTranscriptEditorAssigned(publicTranscript, next.editorUserId, actor);
  }
  if (reviewerFirstAssignment || reviewerReassigned) {
    notifyTranscriptReviewerAssigned(
      publicTranscript,
      next.reviewerUserId,
      actor,
      reviewerFirstAssignment,
    );
  }

  if (messages.length === 0) {
    messages.push('transcriptUpdatedSuccess');
  }

  return { transcript: publicTranscript, messages };
}

export function queryTranscriptList(actor, options = {}) {
  const type = normalizeTranscriptTypeFilter(options.type);
  const jobStatus = normalizeJobStatusFilter(options.jobStatus ?? options.status);
  const customerId = typeof options.customerId === 'string' ? options.customerId.trim() : '';
  const projectId = typeof options.projectId === 'string' ? options.projectId.trim() : '';
  const stenotypistUserId =
    typeof options.stenotypistUserId === 'string' ? options.stenotypistUserId.trim() : '';
  const editorUserId = typeof options.editorUserId === 'string' ? options.editorUserId.trim() : '';
  const reviewerUserId =
    typeof options.reviewerUserId === 'string' ? options.reviewerUserId.trim() : '';
  const transcriptOwnerUserId =
    typeof options.transcriptOwnerUserId === 'string' ? options.transcriptOwnerUserId.trim() : '';
  const dateFrom = normalizeDateKey(options.dateFrom);
  const dateTo = normalizeDateKey(options.dateTo);
  const search = typeof options.search === 'string' ? options.search.trim().toLowerCase() : '';
  const sortBy = normalizeSortKey(options.sortBy);
  const sortDirection = normalizeSortDirection(options.sortDirection);
  const pageSize = Math.min(parsePositiveInt(options.pageSize, 20), 50);
  const page = parsePositiveInt(options.page, 1);

  let scoped = filterTranscriptsForActor(readTranscriptRows(), actor);

  if (type) {
    scoped = scoped.filter((row) => row.type === type);
  }

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
  if (projectId) {
    scoped = scoped.filter((row) => row.projectId === projectId);
  }
  if (stenotypistUserId) {
    scoped = scoped.filter((row) => row.stenotypistUserId === stenotypistUserId);
  }
  if (editorUserId) {
    scoped = scoped.filter((row) => row.editorUserId === editorUserId);
  }
  if (reviewerUserId) {
    scoped = scoped.filter((row) => row.reviewerUserId === reviewerUserId);
  }
  if (transcriptOwnerUserId) {
    scoped = scoped.filter((row) => (row.transcriptOwnerIds ?? []).includes(transcriptOwnerUserId));
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
      const stenotypist = findUserById(row.stenotypistUserId);
      const alias = (stenotypist?.username ?? '').toLowerCase();
      const ownerText = publicRow.transcriptOwnerLabels.join(' ').toLowerCase();
      return (
        row.jobNumber.toLowerCase().includes(search) ||
        row.customerName.toLowerCase().includes(search) ||
        row.projectNumber.toLowerCase().includes(search) ||
        row.stenotypistName.toLowerCase().includes(search) ||
        alias.includes(search) ||
        row.editorName.toLowerCase().includes(search) ||
        row.reviewerName.toLowerCase().includes(search) ||
        ownerText.includes(search)
      );
    });
  }

  const sorted = sortTranscripts(scoped, sortBy, sortDirection);
  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = sorted
    .slice((safePage - 1) * pageSize, safePage * pageSize)
    .map((row) => toPublicTranscript(row, sorted));

  return {
    viewScope: getTranscriptViewScope(actor),
    filterOptions,
    suggestedDateRange,
    transcripts: rows,
    pagination: {
      page: safePage,
      pageSize,
      totalRows,
      totalPages,
    },
  };
}

export function createTranscriptFromJobSubmission(job, submission, actor, options = {}) {
  const existing = findTranscriptByJobId(job.id);
  if (existing) {
    return { errors: ['jobSubmissionTranscriptAlreadyExists'] };
  }

  const publicJob = toPublicJob(job);
  const project = findProjectRecordById(job.projectId);
  const now = new Date().toISOString();
  const receipt = submission.receipt ?? {};

  const transcript = {
    id: `tr-${crypto.randomUUID().slice(0, 8)}`,
    jobId: job.id,
    jobNumber: job.jobNumber,
    type: normalizeTranscriptType(options.type),
    status: normalizeTranscriptStatus(options.status ?? 'finished'),
    customerId: publicJob.customerId,
    customerName: publicJob.customerName,
    projectId: job.projectId,
    projectNumber: publicJob.projectNumber,
    date: job.date,
    time: job.time,
    stenotypistUserId: job.stenotypistUserId ?? '',
    stenotypistName: publicJob.stenotypistName,
    expedite: job.expedite === true,
    receiptNumberStenotypist: receipt.receiptNumberStenotypist ?? '',
    startTimeStenotypist: receipt.startTimeStenotypist ?? '',
    endTimeStenotypist: receipt.endTimeStenotypist ?? '',
    ...createEmptyTranscriptWorkflowFields(),
    files: normalizeTranscriptFiles(
      {
        rawFiles: submission.rawFiles,
        attachmentFiles: submission.attachmentFiles,
        otherFiles: submission.otherFiles,
      },
      submission,
    ),
    submission: {
      rawFiles: submission.rawFiles,
      attachmentFiles: submission.attachmentFiles,
      otherFiles: submission.otherFiles,
      sameDayActions: submission.sameDayActions,
      receipt: submission.receipt,
      transcriptPlainText: submission.transcriptPlainText ?? '',
      transcriptTimestampsText: submission.transcriptTimestampsText ?? '',
      transcriptCharacterCount: submission.transcriptCharacterCount,
    },
    transcriptOwnerIds: project?.transcriptOwnerIds ?? [],
    createdByUserId: actor?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const rows = readTranscriptRows();
  rows.push(transcript);
  writeTranscriptRows(rows);

  return { transcript: toPublicTranscript(transcript) };
}
