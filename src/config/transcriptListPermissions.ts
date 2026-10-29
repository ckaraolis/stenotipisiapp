import { canPerformJobWorkflowAction } from './job';
import { canEditTranscriptDetails } from './transcriptDetails';
import { JOB_STATUS_WORKFLOW_ORDER } from '../types/job';
import type { JobStatus } from '../types/job';
import type { TranscriptRecord } from '../types/transcript';
import type { UserRole } from './roles';
import { normalizeRoles } from './roles';

export type TranscriptListInlineAction =
  | 'edit'
  | 'edited'
  | 'reviewed'
  | 'publish'
  | 'report'
  | 'files'
  | 'download';

function getAssignmentRoles(transcript: TranscriptRecord, actorId: string) {
  const roles: Array<'stenotypist' | 'editor' | 'reviewer'> = [];
  if (transcript.stenotypistUserId === actorId) roles.push('stenotypist');
  if (transcript.editorUserId === actorId) roles.push('editor');
  if (transcript.reviewerUserId === actorId) roles.push('reviewer');
  return roles;
}

export function isJobStatusAfter(status: string, marker: JobStatus): boolean {
  const currentIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(status as JobStatus);
  const markerIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(marker);
  if (currentIndex === -1 || markerIndex === -1) return false;
  return currentIndex > markerIndex;
}

export function isJobStatusBefore(status: string, marker: JobStatus): boolean {
  const currentIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(status as JobStatus);
  const markerIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(marker);
  if (currentIndex === -1 || markerIndex === -1) return false;
  return currentIndex < markerIndex;
}

export function shouldShowTranscriptEditDuration(jobStatus: string): boolean {
  return isJobStatusAfter(jobStatus, 'edited');
}

export function shouldShowTranscriptDeadline(jobStatus: string): boolean {
  return jobStatus !== 'published';
}

export function getTranscriptDownloadTarget(
  transcript: TranscriptRecord,
): { slot: string; fileId: string; name: string } | null {
  const approved = transcript.files?.approvedTranscriptFile;
  if (approved?.storageId && approved.id) {
    return { slot: 'approved_transcript', fileId: approved.id, name: approved.name };
  }
  const edited = transcript.files?.editedRawFiles?.[0];
  if (edited?.storageId && edited.id) {
    return { slot: 'edited_transcript', fileId: edited.id, name: edited.name };
  }
  const raw = transcript.files?.rawFiles?.transcript;
  if (raw?.storageId && raw.id) {
    return { slot: 'raw_transcript', fileId: raw.id, name: raw.name };
  }
  return null;
}

export function getTranscriptListInlineActions(
  transcript: TranscriptRecord,
  roleOrRoles: UserRole[] | UserRole | null | undefined,
  actorId: string,
): TranscriptListInlineAction[] {
  const actions: TranscriptListInlineAction[] = [];
  const assignmentRoles = getAssignmentRoles(transcript, actorId);
  const jobStatus = transcript.jobStatus;

  if (canEditTranscriptDetails(roleOrRoles)) {
    actions.push('edit');
  }

  if (
    canPerformJobWorkflowAction('edit_submit_transcript_for_review', {
      status: jobStatus,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('edited');
  }

  if (
    canPerformJobWorkflowAction('submit_reviewed_transcript', {
      status: jobStatus,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('reviewed');
  }

  if (
    canPerformJobWorkflowAction('publish_transcript', {
      status: jobStatus,
      roleOrRoles,
      assignmentRoles: [],
    })
  ) {
    actions.push('publish');
  }

  actions.push('report', 'files');

  if (getTranscriptDownloadTarget(transcript)) {
    actions.push('download');
  }

  return actions;
}

export function canUseTranscriptEditorFilter(
  viewScope: string,
  roleOrRoles: UserRole[] | UserRole | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return viewScope === 'all' || roles.includes('manager') || roles.includes('super_admin');
}

export function canUseTranscriptReviewerFilter(
  viewScope: string,
  roleOrRoles: UserRole[] | UserRole | null | undefined,
): boolean {
  return canUseTranscriptEditorFilter(viewScope, roleOrRoles);
}

export function canUseTranscriptOwnerFilter(
  viewScope: string,
  roleOrRoles: UserRole[] | UserRole | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return viewScope === 'all' || viewScope === 'assigned' || roles.includes('manager');
}
