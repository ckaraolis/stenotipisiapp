import { JOB_STATUS_PHASE, normalizeJobStatus } from './jobCatalog.js';
import { findJobById, listJobsByProjectId } from './jobs.js';
import { getTranscriptOwnerProjectIds } from './projects.js';
import { normalizeRoles } from './roles.js';
import { isManagerActor, isStenotypistActor } from './jobAccess.js';

const COMPLETED_JOB_PHASE = 'completed';
const INACTIVE_JOB_STATUSES = new Set(['rejected', 'deleted']);

function transcriptHasUploadedRawData(transcript) {
  const raw = transcript.files?.rawFiles ?? {};
  return Boolean(raw.rawZip || raw.transcriptWithTimestamps || raw.transcript);
}

function isJobStatusInCompletedPhase(status) {
  return JOB_STATUS_PHASE[normalizeJobStatus(status)] === COMPLETED_JOB_PHASE;
}

/** §4 — Project phase is completed when all active jobs are published/reconciled/invoiced. */
export function isProjectPhaseCompleted(projectId) {
  if (!projectId) return false;
  const jobs = listJobsByProjectId(projectId).filter(
    (job) => !INACTIVE_JOB_STATUSES.has(normalizeJobStatus(job.status)),
  );
  if (jobs.length === 0) return false;
  return jobs.every((job) => isJobStatusInCompletedPhase(job.status));
}

function getEditorProjectIds(actorId, transcripts) {
  const projectIds = new Set();
  if (!actorId) return projectIds;
  for (const transcript of transcripts) {
    if (transcript.projectId && transcript.editorUserId === actorId) {
      projectIds.add(transcript.projectId);
    }
  }
  return projectIds;
}

function getStenotypistProjectIds(actorId, transcripts) {
  const projectIds = new Set();
  if (!actorId) return projectIds;
  for (const transcript of transcripts) {
    if (
      transcript.projectId &&
      transcript.stenotypistUserId === actorId &&
      transcriptHasUploadedRawData(transcript)
    ) {
      projectIds.add(transcript.projectId);
    }
  }
  return projectIds;
}

function getCompletedProjectIds(transcripts) {
  const projectIds = new Set();
  for (const transcript of transcripts) {
    if (transcript.projectId) {
      projectIds.add(transcript.projectId);
    }
  }
  const completed = new Set();
  for (const projectId of projectIds) {
    if (isProjectPhaseCompleted(projectId)) {
      completed.add(projectId);
    }
  }
  return completed;
}

function hasActiveReviewerAccess(actorId, transcript) {
  if (!actorId || transcript.reviewerUserId !== actorId) return false;
  const job = findJobById(transcript.jobId);
  return normalizeJobStatus(job?.status) === 'in_review';
}

function isTranscriptOwnerOnlyActor(actor) {
  const roles = normalizeRoles(actor);
  if (!roles.includes('transcript_owner')) return false;
  if (roles.includes('super_admin') || roles.includes('manager')) return false;
  return !roles.includes('stenotypist');
}

export function canEditTranscriptDetails(actor) {
  const roles = normalizeRoles(actor);
  return roles.includes('super_admin') || roles.includes('manager');
}

export function buildTranscriptAccessContext(actor, allTranscripts = []) {
  const actorId = actor?.id ?? '';
  const completedProjectIds = getCompletedProjectIds(allTranscripts);
  const stenotypistProjectIds = getStenotypistProjectIds(actorId, allTranscripts);

  return {
    actorId,
    ownerProjectIds: getTranscriptOwnerProjectIds(actorId),
    editorProjectIds: getEditorProjectIds(actorId, allTranscripts),
    stenotypistProjectIds: new Set(
      [...stenotypistProjectIds].filter((projectId) => !completedProjectIds.has(projectId)),
    ),
  };
}

export function getTranscriptViewScope(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || isManagerActor(actor)) {
    return 'all';
  }
  if (isTranscriptOwnerOnlyActor(actor) || roles.includes('transcript_owner')) {
    return 'assigned';
  }
  if (isStenotypistActor(actor)) {
    return 'own';
  }
  return 'none';
}

export function canAccessTranscriptRecord(
  actor,
  transcript,
  allTranscripts = [],
  context = null,
) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || isManagerActor(actor)) {
    return true;
  }

  const ctx = context ?? buildTranscriptAccessContext(actor, allTranscripts);
  const actorId = ctx.actorId;
  const projectId = transcript.projectId ?? '';

  if (projectId && ctx.ownerProjectIds.has(projectId)) {
    return true;
  }

  if (projectId && ctx.editorProjectIds.has(projectId)) {
    return true;
  }

  if (projectId && ctx.stenotypistProjectIds.has(projectId)) {
    return true;
  }

  if (hasActiveReviewerAccess(actorId, transcript)) {
    return true;
  }

  return false;
}

export function filterTranscriptsForActor(transcripts, actor) {
  const context = buildTranscriptAccessContext(actor, transcripts);
  return transcripts.filter((transcript) =>
    canAccessTranscriptRecord(actor, transcript, transcripts, context),
  );
}
