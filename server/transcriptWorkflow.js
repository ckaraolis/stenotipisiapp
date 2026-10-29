import crypto from 'node:crypto';
import { canPerformJobWorkflowAction } from './jobCatalog.js';
import { findJobById, patchJobFromTranscriptDetails } from './jobs.js';
import { listUsers } from './db.js';
import { queueNotification } from './notifications.js';
import { canAccessTranscriptRecord } from './transcriptAccess.js';
import { normalizeRoles } from './roles.js';
import { parseEditDurationFromSgxml } from './transcriptSgxml.js';
import { validateEditedTranscriptFileName } from './editedTranscriptWorkflow.js';
import { validateReviewedTranscriptFileName } from './reviewedTranscriptWorkflow.js';
import {
  decodeUploadContent,
  createStorageId,
  storeTranscriptFileBinary,
} from './transcriptFileStorage.js';
import {
  findTranscriptRowById,
  readTranscriptRows,
  toPublicTranscript,
  writeTranscriptRows,
} from './transcripts.js';

function getAssignmentRoles(transcript, actorId) {
  const roles = [];
  if (transcript.editorUserId === actorId) roles.push('editor');
  if (transcript.reviewerUserId === actorId) roles.push('reviewer');
  if (transcript.stenotypistUserId === actorId) roles.push('stenotypist');
  return roles;
}

function createUploadedFileEntry(input, actor, previous = null) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { errors: ['transcriptFileNameRequired'] };
  const buffer = decodeUploadContent(input.contentBase64);
  if (!buffer || buffer.length === 0) {
    return { errors: ['transcriptFileContentRequired'] };
  }
  const storageId = createStorageId();
  const entry = {
    id: previous?.id || `file-${crypto.randomUUID().slice(0, 8)}`,
    name,
    size: buffer.length,
    type: typeof input.type === 'string' ? input.type.trim() : 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    storageId,
    history: Array.isArray(previous?.history) ? [...previous.history] : [],
  };
  if (previous?.name) {
    entry.history.push({
      id: previous.id,
      name: previous.name,
      size: previous.size ?? 0,
      type: previous.type ?? '',
      uploadedAt: previous.uploadedAt ?? '',
      uploadedByUserId: actor?.id ?? null,
      storageId: previous.storageId ?? '',
    });
  }
  return { entry, buffer };
}

function getJobStatus(transcript) {
  const job = findJobById(transcript.jobId);
  return job?.status ?? '';
}

function listActiveManagerUserIds() {
  return listUsers()
    .filter(
      (user) => user.status === 'active' && normalizeRoles(user).includes('manager'),
    )
    .map((user) => user.id);
}

function notifyBypassApprovalPublished(transcript, actor) {
  const notifyIds = new Set(listActiveManagerUserIds());
  for (const ownerId of transcript.transcriptOwnerIds ?? []) {
    if (ownerId) notifyIds.add(ownerId);
  }
  if (actor?.id) notifyIds.delete(actor.id);

  for (const targetUserId of notifyIds) {
    queueNotification({
      type: 'transcript_published_bypass',
      message: `Transcript for job ${transcript.jobNumber} has been published (bypass approval).`,
      targetUserId,
      createdByUserId: actor?.id ?? null,
      actionPath: '/transcripts/steno',
      entityType: 'transcript',
      entityId: transcript.id,
      emailDetails: [
        { label: 'Job Number', value: transcript.jobNumber },
        { label: 'Customer', value: transcript.customerName },
        { label: 'Status', value: 'Published (bypass approval)' },
      ],
    });
  }
}

export function submitEditedTranscript(transcriptId, input, actor) {
  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) return { errors: ['transcriptNotFound'] };

  const transcript = rows[index];
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const jobStatus = getJobStatus(transcript);
  const assignmentRoles = getAssignmentRoles(transcript, actor?.id ?? '');
  if (
    !canPerformJobWorkflowAction('edit_submit_transcript_for_review', {
      status: jobStatus,
      userOrRoles: actor,
      assignmentRoles,
    })
  ) {
    return { errors: ['transcriptWorkflowNotAllowed'] };
  }

  const upload = createUploadedFileEntry(input, actor);
  if (upload.errors) return upload;

  const filenameError = validateEditedTranscriptFileName(transcript.jobNumber, upload.entry.name);
  if (filenameError) {
    return { errors: [filenameError] };
  }

  storeTranscriptFileBinary(transcriptId, upload.entry.storageId, upload.buffer);

  const files = { ...transcript.files, editedRawFiles: [...(transcript.files?.editedRawFiles ?? [])] };
  const existingIndex = files.editedRawFiles.findIndex((row) => row.id === upload.entry.id);
  if (existingIndex >= 0) {
    files.editedRawFiles[existingIndex] = upload.entry;
  } else {
    files.editedRawFiles.push(upload.entry);
  }

  let editDurationMinutes = transcript.editDurationMinutes ?? 0;
  let editDurationSegments = transcript.editDurationSegments ?? [];
  let sgxmlContent = transcript.sgxmlContent ?? '';
  if (typeof input.sgxmlContent === 'string' && input.sgxmlContent.trim()) {
    const parsed = parseEditDurationFromSgxml(input.sgxmlContent);
    editDurationMinutes = parsed.totalMinutes;
    editDurationSegments = parsed.segments;
    sgxmlContent = input.sgxmlContent.trim();
  }

  const editorName = actor?.fullName || actor?.username || transcript.editorName || '';
  const next = {
    ...transcript,
    files,
    editDurationMinutes,
    editDurationSegments,
    sgxmlContent,
    editorUserId: actor?.id ?? transcript.editorUserId ?? '',
    editorName,
    editorRemarks: typeof input.remarks === 'string' ? input.remarks.trim() : transcript.editorRemarks,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = next;
  writeTranscriptRows(rows);

  const jobResult = patchJobFromTranscriptDetails(next.jobId, { status: 'edited' }, actor);
  if (jobResult.errors) return jobResult;

  queueNotification({
    type: 'transcript_edited_submitted',
    message: `Edited transcript submitted for job ${next.jobNumber}.`,
    targetUserId: next.reviewerUserId || null,
    createdByUserId: actor?.id ?? null,
    actionPath: '/transcripts/steno',
    entityType: 'transcript',
    entityId: next.id,
    emailDetails: [
      { label: 'Job Number', value: next.jobNumber },
      { label: 'Customer', value: next.customerName },
      { label: 'Status', value: 'Edited — awaiting review' },
    ],
  });

  return {
    transcript: toPublicTranscript(next, rows),
    messages: ['transcriptEditedSubmittedSuccess'],
  };
}

export function submitReviewedTranscript(transcriptId, input, actor) {
  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) return { errors: ['transcriptNotFound'] };

  const transcript = rows[index];
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const jobStatus = getJobStatus(transcript);
  const assignmentRoles = getAssignmentRoles(transcript, actor?.id ?? '');
  if (
    !canPerformJobWorkflowAction('submit_reviewed_transcript', {
      status: jobStatus,
      userOrRoles: actor,
      assignmentRoles,
    })
  ) {
    return { errors: ['transcriptWorkflowNotAllowed'] };
  }

  const upload = createUploadedFileEntry(input, actor);
  if (upload.errors) return upload;

  const filenameError = validateReviewedTranscriptFileName(transcript.jobNumber, upload.entry.name);
  if (filenameError) {
    return { errors: [filenameError] };
  }

  storeTranscriptFileBinary(transcriptId, upload.entry.storageId, upload.buffer);

  const files = {
    ...transcript.files,
    reviewedRawFiles: [...(transcript.files?.reviewedRawFiles ?? [])],
  };
  const existingIndex = files.reviewedRawFiles.findIndex((row) => row.id === upload.entry.id);
  if (existingIndex >= 0) {
    files.reviewedRawFiles[existingIndex] = upload.entry;
  } else {
    files.reviewedRawFiles.push(upload.entry);
  }

  const now = new Date().toISOString();
  const reviewerName = actor?.fullName || actor?.username || transcript.reviewerName || '';
  const bypassApproval = transcript.bypassApproval === true;
  const next = {
    ...transcript,
    files,
    reviewEndTime: now,
    reviewStartTime: transcript.reviewStartTime || now,
    reviewerUserId: actor?.id ?? transcript.reviewerUserId ?? '',
    reviewerName,
    reviewerRemarks:
      typeof input.remarks === 'string' ? input.remarks.trim() : transcript.reviewerRemarks,
    status: bypassApproval ? 'published' : transcript.status,
    updatedAt: now,
  };
  rows[index] = next;
  writeTranscriptRows(rows);

  const nextJobStatus = bypassApproval ? 'published' : 'reviewed';
  const jobResult = patchJobFromTranscriptDetails(next.jobId, { status: nextJobStatus }, actor);
  if (jobResult.errors) return jobResult;

  if (bypassApproval) {
    notifyBypassApprovalPublished(next, actor);
    return {
      transcript: toPublicTranscript(next, rows),
      messages: ['transcriptReviewedBypassPublishedSuccess'],
    };
  }

  queueNotification({
    type: 'transcript_reviewed_submitted',
    message: `Reviewed transcript submitted for job ${next.jobNumber}.`,
    targetUserId: next.publisherUserId || null,
    createdByUserId: actor?.id ?? null,
    actionPath: '/transcripts/steno',
    entityType: 'transcript',
    entityId: next.id,
    emailDetails: [
      { label: 'Job Number', value: next.jobNumber },
      { label: 'Customer', value: next.customerName },
      { label: 'Status', value: 'Reviewed — awaiting publish' },
    ],
  });

  return {
    transcript: toPublicTranscript(next, rows),
    messages: ['transcriptReviewedSubmittedSuccess'],
  };
}

export function publishTranscript(transcriptId, input, actor) {
  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) return { errors: ['transcriptNotFound'] };

  const transcript = rows[index];
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const jobStatus = getJobStatus(transcript);
  if (
    !canPerformJobWorkflowAction('publish_transcript', {
      status: jobStatus,
      userOrRoles: actor,
      assignmentRoles: [],
    })
  ) {
    return { errors: ['transcriptWorkflowNotAllowed'] };
  }

  const publisherRemarks =
    typeof input.publisherRemarks === 'string' ? input.publisherRemarks.trim() : '';

  const next = {
    ...transcript,
    status: 'published',
    publisherRemarks,
    publisherUserId: actor?.id ?? transcript.publisherUserId,
    publisherName: actor?.fullName || actor?.username || transcript.publisherName,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = next;
  writeTranscriptRows(rows);

  const jobResult = patchJobFromTranscriptDetails(next.jobId, { status: 'published' }, actor);
  if (jobResult.errors) return jobResult;

  const ownerIds = new Set((next.transcriptOwnerIds ?? []).filter(Boolean));
  const notifyIds = new Set();
  for (const user of listUsers()) {
    if (user.status !== 'active') continue;
    if (!user.id || user.id === actor?.id) continue;
    if (ownerIds.has(user.id)) continue;
    if (!canAccessTranscriptRecord(user, next, rows)) continue;
    notifyIds.add(user.id);
  }

  for (const targetUserId of notifyIds) {
    queueNotification({
      type: 'transcript_published',
      message: `Transcript for job ${next.jobNumber} has been published.`,
      targetUserId,
      createdByUserId: actor?.id ?? null,
      actionPath: '/transcripts/steno',
      entityType: 'transcript',
      entityId: next.id,
      emailDetails: [
        { label: 'Job Number', value: next.jobNumber },
        { label: 'Customer', value: next.customerName },
        { label: 'Status', value: 'Published' },
      ],
    });
  }

  return {
    transcript: toPublicTranscript(next, rows),
    messages: ['transcriptPublishedSuccess'],
  };
}
