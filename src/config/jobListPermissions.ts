import { getPhaseForJobStatus } from './job';
import { normalizeRoles } from './roles';
import type { UserRole } from './roles';
import type { JobAssignmentRole } from '../types/job';
import type { JobRecord } from '../types/jobRecord';
import {
  canPerformJobWorkflowAction,
  getCrossCuttingActionsForStatus,
} from './job';

export type JobListInlineAction =
  | 'edit'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'confirm'
  | 'finish'
  | 'delete';

export interface JobListActorContext {
  userId?: string;
  customerId?: string;
  roleOrRoles: string | readonly string[] | null | undefined;
  assignmentRoles?: readonly JobAssignmentRole[];
}

const REQUESTED_OR_SCHEDULED_PHASES = new Set(['requested', 'scheduled']);

/** §4.11 — Roles with access to Job List and Details Form. */
const JOB_LIST_ACCESS_ROLES: readonly UserRole[] = [
  'district_admin',
  'coordinator',
  'stenotypist',
  'manager',
];

/** §4.11.1 — District Admin job list view (not manager/coordinator/super admin). */
export function isDistrictAdminJobListView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (
    roles.includes('super_admin') ||
    roles.includes('manager') ||
    roles.includes('coordinator')
  ) {
    return false;
  }
  return roles.includes('district_admin');
}

/** §4.11.2 — Coordinator job list view (not manager/super admin). */
export function isCoordinatorJobListView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('coordinator');
}

/** §4.11.3 — Manager job list view (not super admin). */
export function isManagerJobListView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (roles.includes('super_admin')) {
    return false;
  }
  return roles.includes('manager');
}

/** §4.11.4 — Stenotypist job list view (not manager/coordinator/district admin/super admin). */
export function isStenotypistJobListView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (
    roles.includes('super_admin') ||
    roles.includes('manager') ||
    roles.includes('coordinator') ||
    roles.includes('district_admin')
  ) {
    return false;
  }
  return roles.includes('stenotypist');
}

export function isCustomerOrganisationJobListView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isDistrictAdminJobListView(roleOrRoles) || isCoordinatorJobListView(roleOrRoles);
}

/** §4.11.3.2 — Manager and super admin have full access to the job details form. */
export function hasFullJobDetailsFormAccess(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return roles.includes('super_admin') || roles.includes('manager');
}

export function isCustomerOrganisationJobDetailsView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isCustomerOrganisationJobListView(roleOrRoles);
}

/** §4.11.1.2 — District Admin job details form defaults. */
export function isDistrictAdminJobDetailsView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isDistrictAdminJobListView(roleOrRoles);
}

/** §4.11.2.2 — Coordinator job details form defaults. */
export function isCoordinatorJobDetailsView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isCoordinatorJobListView(roleOrRoles);
}

/** §4.11.3.2 — Manager job details form (full access). */
export function isManagerJobDetailsView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isManagerJobListView(roleOrRoles);
}

/** §4.11.4.2 — Stenotypist job details form (job number, stenotypist, remarks only). */
export function isStenotypistJobDetailsView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return isStenotypistJobListView(roleOrRoles);
}

/** §4.11.5 — Transcript owners cannot access the jobs module. */
export function canAccessJobListModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (roles.includes('transcript_owner') && !roles.some((role) => JOB_LIST_ACCESS_ROLES.includes(role))) {
    return false;
  }
  if (roles.includes('super_admin')) return true;
  return roles.some((role) => JOB_LIST_ACCESS_ROLES.includes(role));
}

export function isRestrictedJobDetailsFormView(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return (
    isCustomerOrganisationJobDetailsView(roleOrRoles) ||
    isStenotypistJobDetailsView(roleOrRoles)
  );
}

export function getJobListCapabilities(
  roleOrRoles: string | readonly string[] | null | undefined,
) {
  return {
    /** §4.11.1.1 / §4.11.2.1 — Customer-org roles do not see the customer filter. */
    showCustomerFilter: !isCustomerOrganisationJobListView(roleOrRoles),
    showConfirmAll:
      !isDistrictAdminJobListView(roleOrRoles) && !isStenotypistJobListView(roleOrRoles),
    showAddNew: !isStenotypistJobListView(roleOrRoles),
  };
}

type JobPermissionFields = Pick<
  JobRecord,
  'ownerUserId' | 'status' | 'customerId' | 'stenotypistUserId'
>;

function jobMatchesCustomer(job: JobPermissionFields, customerId?: string): boolean {
  if (!customerId) return false;
  return job.customerId === customerId;
}

export function canDistrictAdminEditJob(job: JobPermissionFields, userId?: string): boolean {
  if (!userId || job.ownerUserId !== userId) return false;
  const phase = getPhaseForJobStatus(job.status);
  return phase ? REQUESTED_OR_SCHEDULED_PHASES.has(phase) : false;
}

export function canDistrictAdminDeleteJob(job: JobRecord, userId?: string): boolean {
  if (!userId || job.ownerUserId !== userId) return false;
  return job.status === 'new';
}

export function canCoordinatorEditJob(job: JobPermissionFields, customerId?: string): boolean {
  if (!jobMatchesCustomer(job, customerId)) return false;
  const phase = getPhaseForJobStatus(job.status);
  return phase ? REQUESTED_OR_SCHEDULED_PHASES.has(phase) : false;
}

export function canCoordinatorRejectJob(job: JobPermissionFields, customerId?: string): boolean {
  return canCoordinatorEditJob(job, customerId);
}

export function canCoordinatorDeleteJob(job: JobPermissionFields, customerId?: string): boolean {
  if (!jobMatchesCustomer(job, customerId)) return false;
  return getPhaseForJobStatus(job.status) === 'requested';
}

export function canManagerRejectJob(job: JobRecord): boolean {
  const phase = getPhaseForJobStatus(job.status);
  return phase ? REQUESTED_OR_SCHEDULED_PHASES.has(phase) : false;
}

export function canManagerDeleteJob(job: JobRecord, userId?: string): boolean {
  if (!userId || job.ownerUserId !== userId) return false;
  return !job.stenotypistUserId.trim();
}

function isStenotypistCreatorOrAssignee(job: JobPermissionFields, userId?: string): boolean {
  if (!userId) return false;
  return job.ownerUserId === userId || job.stenotypistUserId === userId;
}

export function canStenotypistEditJob(job: JobPermissionFields, userId?: string): boolean {
  if (!isStenotypistCreatorOrAssignee(job, userId)) return false;
  return job.status === 'assigned';
}

export function canStenotypistDeleteJob(job: JobRecord, userId?: string): boolean {
  if (!userId || job.ownerUserId !== userId) return false;
  return true;
}

/** §4.11.4.1 — Jobs assigned to the stenotypist, plus jobs they created (for delete). */
export function filterJobsForStenotypistJobList(
  jobs: JobRecord[],
  userId?: string,
): JobRecord[] {
  if (!userId) return [];
  return jobs.filter(
    (job) => job.stenotypistUserId === userId || job.ownerUserId === userId,
  );
}

/** §4.11 — Scope job list rows per role (client-side; server also filters). */
export function filterJobsForJobListView(
  jobs: JobRecord[],
  context: Pick<JobListActorContext, 'userId' | 'customerId' | 'roleOrRoles'>,
): JobRecord[] {
  if (isStenotypistJobListView(context.roleOrRoles)) {
    return filterJobsForStenotypistJobList(jobs, context.userId);
  }
  if (isCustomerOrganisationJobListView(context.roleOrRoles)) {
    if (!context.customerId) return [];
    return jobs.filter((job) => job.customerId === context.customerId);
  }
  return jobs;
}

export function getJobListInlineActions(
  job: JobRecord,
  context: JobListActorContext,
): JobListInlineAction[] {
  if (isDistrictAdminJobListView(context.roleOrRoles)) {
    const actions: JobListInlineAction[] = [];
    if (canDistrictAdminEditJob(job, context.userId)) {
      actions.push('edit');
    }
    if (canDistrictAdminDeleteJob(job, context.userId)) {
      actions.push('delete');
    }
    return actions;
  }

  if (isCoordinatorJobListView(context.roleOrRoles)) {
    const actions: JobListInlineAction[] = [];
    if (canCoordinatorEditJob(job, context.customerId)) {
      actions.push('edit');
    }
    if (
      canPerformJobWorkflowAction('approve_job', {
        status: job.status,
        roleOrRoles: context.roleOrRoles,
        assignmentRoles: context.assignmentRoles ?? [],
      })
    ) {
      actions.push('approve');
    }
    if (canCoordinatorRejectJob(job, context.customerId)) {
      actions.push('reject');
    }
    if (canCoordinatorDeleteJob(job, context.customerId)) {
      actions.push('delete');
    }
    return actions;
  }

  if (isManagerJobListView(context.roleOrRoles)) {
    const roleOrRoles = context.roleOrRoles;
    const assignmentRoles = context.assignmentRoles ?? [];
    const actions: JobListInlineAction[] = [];

    if (job.status !== 'deleted') {
      actions.push('edit');
    }

    if (
      canPerformJobWorkflowAction('approve_job', {
        status: job.status,
        roleOrRoles,
        assignmentRoles,
      })
    ) {
      actions.push('approve');
    }

    if (canManagerRejectJob(job)) {
      actions.push('reject');
    }

    if (
      canPerformJobWorkflowAction('provisionally_assign_job', {
        status: job.status,
        roleOrRoles,
        assignmentRoles,
      })
    ) {
      actions.push('assign');
    }

    if (
      canPerformJobWorkflowAction('confirm_job_assignment', {
        status: job.status,
        roleOrRoles,
        assignmentRoles,
      })
    ) {
      actions.push('confirm');
    }

    if (canManagerDeleteJob(job, context.userId)) {
      actions.push('delete');
    }

    // §4.11.3.1 — Upload Raw Data and Upload Attachments are not inline actions for Manager.
    return actions;
  }

  if (isStenotypistJobListView(context.roleOrRoles)) {
    const actions: JobListInlineAction[] = [];
    if (canStenotypistEditJob(job, context.userId)) {
      actions.push('edit');
    }
    if (canStenotypistDeleteJob(job, context.userId)) {
      actions.push('delete');
    }
    // §4.11.4.1 — Approve, Reject, Assign, and Confirm are not inline actions for Stenotypist.
    return actions;
  }

  const roleOrRoles = context.roleOrRoles;
  const assignmentRoles = context.assignmentRoles ?? [];
  const actions: JobListInlineAction[] = [];

  if (job.status !== 'deleted') {
    actions.push('edit');
  }

  if (
    canPerformJobWorkflowAction('approve_job', {
      status: job.status,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('approve');
  }

  if (
    getCrossCuttingActionsForStatus(job.status, roleOrRoles).some(
      (action) => action.id === 'reject_job',
    )
  ) {
    actions.push('reject');
  }

  if (
    canPerformJobWorkflowAction('provisionally_assign_job', {
      status: job.status,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('assign');
  }

  if (
    canPerformJobWorkflowAction('confirm_job_assignment', {
      status: job.status,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('confirm');
  }

  if (
    canPerformJobWorkflowAction('upload_raw_data_attachments', {
      status: job.status,
      roleOrRoles,
      assignmentRoles,
    })
  ) {
    actions.push('finish');
  }

  if (
    getCrossCuttingActionsForStatus(job.status, roleOrRoles).some(
      (action) => action.id === 'delete_job',
    )
  ) {
    actions.push('delete');
  }

  return actions;
}
