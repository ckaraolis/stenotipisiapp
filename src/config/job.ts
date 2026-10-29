import type { TranslationKey } from '../i18n/translations';
import type { UserRole } from './roles';
import { isSuperAdminRole, normalizeRoles } from './roles';
import {
  JOB_CROSS_CUTTING_ACTIONS,
  JOB_PHASE_OPTIONS,
  JOB_PHASE_ORDER,
  JOB_PHASE_STATUSES,
  JOB_STATUS_OPTIONS,
  JOB_STATUS_PHASE,
  JOB_STATUS_TRANSITIONS,
  JOB_STATUS_WORKFLOW_ORDER,
  JOB_WORKFLOW_ACTIONS,
  type JobActionId,
  type JobAssignmentRole,
  type JobPhase,
  type JobStatus,
} from '../types/job';

const PHASE_LABEL_KEYS: Record<JobPhase, TranslationKey> = {
  requested: 'jobPhaseRequested',
  scheduled: 'jobPhaseScheduled',
  in_progress: 'jobPhaseInProgress',
  completed: 'jobPhaseCompleted',
  cancelled: 'jobPhaseCancelled',
};

const STATUS_LABEL_KEYS: Record<JobStatus, TranslationKey> = {
  new: 'jobStatusNew',
  approved: 'jobStatusApproved',
  pending: 'jobStatusPending',
  assigned: 'jobStatusAssigned',
  finished: 'jobStatusFinished',
  edited: 'jobStatusEdited',
  in_review: 'jobStatusInReview',
  reviewed: 'jobStatusReviewed',
  published: 'jobStatusPublished',
  reconciled: 'jobStatusReconciled',
  invoiced: 'jobStatusInvoiced',
  rejected: 'jobStatusRejected',
  deleted: 'jobStatusDeleted',
};

const ACTION_LABEL_KEYS: Record<JobActionId, TranslationKey> = {
  add_new_job: 'jobActionAddNew',
  approve_job: 'jobActionApprove',
  add_new_job_manager: 'jobActionAddNew',
  provisionally_assign_job: 'jobActionProvisionallyAssign',
  confirm_job_assignment: 'jobActionConfirmAssignment',
  add_new_job_assign_self: 'jobActionAddNewAssignSelf',
  upload_raw_data_attachments: 'jobActionUploadRawData',
  edit_submit_transcript_for_review: 'jobActionEditSubmitTranscript',
  pick_transcript_for_review: 'jobActionPickTranscriptForReview',
  submit_reviewed_transcript: 'jobActionSubmitReviewedTranscript',
  publish_transcript: 'jobActionPublishTranscript',
  reconcile_receipt_data: 'jobActionReconcileReceipt',
  generate_invoices: 'jobActionGenerateInvoices',
  reject_job: 'jobActionReject',
  delete_job: 'jobActionDelete',
};

export {
  JOB_CROSS_CUTTING_ACTIONS,
  JOB_PHASE_OPTIONS,
  JOB_PHASE_ORDER,
  JOB_PHASE_STATUSES,
  JOB_STATUS_OPTIONS,
  JOB_STATUS_PHASE,
  JOB_STATUS_TRANSITIONS,
  JOB_STATUS_WORKFLOW_ORDER,
  JOB_WORKFLOW_ACTIONS,
};

export function jobPhaseLabelKey(phase: JobPhase | string): TranslationKey {
  if ((JOB_PHASE_OPTIONS as readonly string[]).includes(phase)) {
    return PHASE_LABEL_KEYS[phase as JobPhase];
  }
  return 'jobPhaseRequested';
}

export function jobStatusLabelKey(status: JobStatus | string): TranslationKey {
  if ((JOB_STATUS_OPTIONS as readonly string[]).includes(status)) {
    return STATUS_LABEL_KEYS[status as JobStatus];
  }
  return 'jobStatusNew';
}

export function jobActionLabelKey(actionId: JobActionId | string): TranslationKey {
  if ((Object.keys(ACTION_LABEL_KEYS) as JobActionId[]).includes(actionId as JobActionId)) {
    return ACTION_LABEL_KEYS[actionId as JobActionId];
  }
  return 'jobActionAddNew';
}

export function getPhaseForJobStatus(status: JobStatus | string): JobPhase | null {
  if ((JOB_STATUS_OPTIONS as readonly string[]).includes(status)) {
    return JOB_STATUS_PHASE[status as JobStatus];
  }
  return null;
}

export function getStatusesForJobPhase(phase: JobPhase | string): readonly JobStatus[] {
  if ((JOB_PHASE_OPTIONS as readonly string[]).includes(phase)) {
    return JOB_PHASE_STATUSES[phase as JobPhase];
  }
  return [];
}

export function getAllowedJobStatusTransitions(status: JobStatus | string): readonly JobStatus[] {
  if ((JOB_STATUS_OPTIONS as readonly string[]).includes(status)) {
    return JOB_STATUS_TRANSITIONS[status as JobStatus];
  }
  return [];
}

export function canTransitionJobStatus(from: JobStatus | string, to: JobStatus | string): boolean {
  return getAllowedJobStatusTransitions(from).includes(to as JobStatus);
}

function hasAnyRole(roleOrRoles: string | readonly string[] | null | undefined, allowed: readonly UserRole[]): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles)) return true;
  return allowed.some((role) => roles.includes(role));
}

export function getWorkflowActionsForStatus(status: JobStatus | string) {
  if (!(JOB_STATUS_OPTIONS as readonly string[]).includes(status)) return [];
  return JOB_WORKFLOW_ACTIONS.filter((action) => action.atStatus === status);
}

export function getCreateJobActions(roleOrRoles: string | readonly string[] | null | undefined) {
  return JOB_WORKFLOW_ACTIONS.filter(
    (action) => action.createEntry && hasAnyRole(roleOrRoles, action.roles),
  );
}

export function getCrossCuttingActionsForStatus(
  status: JobStatus | string,
  roleOrRoles: string | readonly string[] | null | undefined,
) {
  if (!(JOB_STATUS_OPTIONS as readonly string[]).includes(status)) return [];
  return JOB_CROSS_CUTTING_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(status as JobStatus) &&
      hasAnyRole(roleOrRoles, action.roles),
  );
}

export function canPerformJobWorkflowAction(
  actionId: JobActionId,
  {
    status = null,
    roleOrRoles,
    assignmentRoles = [],
  }: {
    status?: JobStatus | string | null;
    roleOrRoles: string | readonly string[] | null | undefined;
    assignmentRoles?: readonly JobAssignmentRole[];
  },
): boolean {
  const action = JOB_WORKFLOW_ACTIONS.find((row) => row.id === actionId);
  if (!action) return false;
  if (!hasAnyRole(roleOrRoles, action.roles)) return false;
  if (action.createEntry) return action.atStatus === null;
  if (status !== action.atStatus) return false;
  if (!action.assignmentRoles?.length) return true;
  return action.assignmentRoles.every((role) => assignmentRoles.includes(role));
}
