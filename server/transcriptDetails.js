import { findCustomerById } from './customers.js';
import { listUsers } from './db.js';
import { findJobById } from './jobs.js';
import { queueNotification } from './notifications.js';
import { findProjectRecordById } from './projects.js';
import { normalizeRoles } from './roles.js';

const PARTICIPANT_ROLES = new Set(['stenotypist', 'manager']);
const PUBLISHER_ROLES = new Set(['manager']);

function parseTimeToMinutes(value) {
  if (typeof value !== 'string' || !value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function slaToHours(sla) {
  if (typeof sla !== 'string') return 24;
  const match = sla.trim().match(/^(\d+)\s*day/i);
  if (!match) return 24;
  return Number(match[1]) * 24;
}

export function getJobEndDateTime(job) {
  const endTime = job?.endTimeAdministrator || job?.endTimeStenotypist || job?.time;
  const minutes = parseTimeToMinutes(endTime);
  if (minutes === null || !job?.date) return null;
  const date = new Date(`${job.date}T12:00:00`);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function getCustomerSlaForJob(job) {
  const project = findProjectRecordById(job?.projectId);
  if (!project?.customerId) return '1 day';
  const customer = findCustomerById(project.customerId);
  return customer?.sla ?? '1 day';
}

/** §2.2 — Remaining time until Job End + SLA (minutes; negative = overdue). */
export function computeTranscriptDeadlineMinutes(job, expedite = false) {
  const endDateTime = getJobEndDateTime(job);
  if (!endDateTime) return null;
  let sla = getCustomerSlaForJob(job);
  if (expedite && typeof sla === 'string') {
    const match = sla.match(/^(\d+)/);
    if (match) {
      const days = Math.max(1, Math.ceil(Number(match[1]) / 2));
      sla = `${days} day${days === 1 ? '' : 's'}`;
    }
  }
  const deadlineMs = endDateTime.getTime() + slaToHours(sla) * 60 * 60 * 1000;
  return Math.round((deadlineMs - Date.now()) / (60 * 1000));
}

export function listTranscriptParticipantCandidates() {
  return listUsers()
    .filter((user) => {
      if (user.status !== 'active') return false;
      const roles = normalizeRoles(user);
      return roles.some((role) => PARTICIPANT_ROLES.has(role));
    })
    .map((user) => ({
      id: user.id,
      fullName: user.fullName ?? '',
      username: user.username ?? '',
      roles: normalizeRoles(user),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}

export function listTranscriptPublisherCandidates() {
  return listUsers()
    .filter(
      (user) => user.status === 'active' && normalizeRoles(user).includes('manager'),
    )
    .map((user) => ({
      id: user.id,
      fullName: user.fullName ?? '',
      username: user.username ?? '',
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}

export function isValidTranscriptParticipant(userId) {
  if (!userId) return true;
  const user = listUsers().find((row) => row.id === userId);
  if (!user) return false;
  return normalizeRoles(user).some((role) => PARTICIPANT_ROLES.has(role));
}

export function isValidTranscriptPublisher(userId) {
  if (!userId) return true;
  const user = listUsers().find((row) => row.id === userId);
  if (!user) return false;
  return normalizeRoles(user).some((role) => PUBLISHER_ROLES.has(role));
}

export function getProjectEditorUserIds(projectId, rows) {
  if (!projectId) return new Set();
  const ids = new Set();
  for (const row of rows) {
    if (row.projectId === projectId && row.editorUserId?.trim()) {
      ids.add(row.editorUserId.trim());
    }
  }
  return ids;
}

/**
 * §2.2 — When the default editor changes, grant the new editor on all sibling
 * transcripts in the same project so they can access and work on them.
 */
export function propagateProjectEditorAssignment(rows, sourceTranscript) {
  const projectId = sourceTranscript?.projectId ?? '';
  const editorUserId = sourceTranscript?.editorUserId?.trim() ?? '';
  const editorName = sourceTranscript?.editorName ?? '';
  if (!projectId || !editorUserId) {
    return 0;
  }

  const updatedAt = sourceTranscript.updatedAt ?? new Date().toISOString();
  let updatedCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.projectId !== projectId || row.id === sourceTranscript.id) {
      continue;
    }
    if (row.editorUserId === editorUserId && row.editorName === editorName) {
      continue;
    }
    rows[index] = {
      ...row,
      editorUserId,
      editorName,
      updatedAt,
    };
    updatedCount += 1;
  }

  return updatedCount;
}

export function enrichTranscriptWithJobContext(transcript, job) {
  const sla = job ? getCustomerSlaForJob(job) : '1 day';
  const deadlineMinutes = job
    ? computeTranscriptDeadlineMinutes(job, transcript.expedite === true)
    : null;
  return {
    jobStatus: job?.status ?? '',
    serviceLevelAgreement: sla,
    deadlineMinutes,
    jobEndTime: job?.endTimeAdministrator || job?.endTimeStenotypist || '',
  };
}

export function notifyTranscriptEditorAssigned(transcript, editorUserId, actor) {
  if (!editorUserId) return;
  queueNotification({
    type: 'transcript_editor_assigned',
    message: `You have been assigned as editor for job ${transcript.jobNumber}.`,
    targetUserId: editorUserId,
    createdByUserId: actor?.id ?? null,
    actionPath: '/transcripts/steno',
    entityType: 'transcript',
    entityId: transcript.id,
    emailDetails: [
      { label: 'Job Number', value: transcript.jobNumber },
      { label: 'Customer', value: transcript.customerName },
      { label: 'Project', value: transcript.projectNumber || transcript.projectId },
      { label: 'Role', value: 'Editor' },
    ],
  });
}

export function notifyTranscriptReviewerAssigned(transcript, reviewerUserId, actor, firstAssignment) {
  if (!reviewerUserId) return;
  queueNotification({
    type: 'transcript_reviewer_assigned',
    message: firstAssignment
      ? `You have been assigned to review job ${transcript.jobNumber}.`
      : `You have been reassigned as reviewer for job ${transcript.jobNumber}.`,
    targetUserId: reviewerUserId,
    createdByUserId: actor?.id ?? null,
    actionPath: '/transcripts/steno',
    entityType: 'transcript',
    entityId: transcript.id,
    emailDetails: [
      { label: 'Job Number', value: transcript.jobNumber },
      { label: 'Customer', value: transcript.customerName },
      { label: 'Project', value: transcript.projectNumber || transcript.projectId },
      { label: 'Role', value: 'Reviewer' },
    ],
  });
}

export function getJobForTranscript(transcript) {
  if (!transcript?.jobId) return null;
  return findJobById(transcript.jobId);
}
