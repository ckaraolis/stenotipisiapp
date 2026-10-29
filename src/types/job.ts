import type { UserRole } from '../config/roles';

/** §4.1 — Job phases group related job statuses. */
export const JOB_PHASE_OPTIONS = [
  'requested',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const;

/** §4.2 — Job statuses and their workflow. */
export const JOB_STATUS_OPTIONS = [
  'new',
  'approved',
  'pending',
  'assigned',
  'finished',
  'edited',
  'in_review',
  'reviewed',
  'published',
  'reconciled',
  'invoiced',
  'rejected',
  'deleted',
] as const;

export type JobPhase = (typeof JOB_PHASE_OPTIONS)[number];
export type JobStatus = (typeof JOB_STATUS_OPTIONS)[number];

/** §4.3 — Job module assignment roles (stenotypist allocated as editor/reviewer on a job). */
export const JOB_ASSIGNMENT_ROLE_OPTIONS = ['stenotypist', 'editor', 'reviewer'] as const;
export type JobAssignmentRole = (typeof JOB_ASSIGNMENT_ROLE_OPTIONS)[number];

/** §4.3 — Swimlane role groups. */
export const JOB_CUSTOMER_ROLES: readonly UserRole[] = ['district_admin', 'coordinator'];
export const JOB_ASTRAEA_ROLES: readonly UserRole[] = [
  'manager',
  'stenotypist',
  'reconciliator',
  'accountant',
];

export const JOB_ACTION_OPTIONS = [
  'add_new_job',
  'approve_job',
  'add_new_job_manager',
  'provisionally_assign_job',
  'confirm_job_assignment',
  'add_new_job_assign_self',
  'upload_raw_data_attachments',
  'edit_submit_transcript_for_review',
  'pick_transcript_for_review',
  'submit_reviewed_transcript',
  'publish_transcript',
  'reconcile_receipt_data',
  'generate_invoices',
  'reject_job',
  'delete_job',
] as const;

export type JobActionId = (typeof JOB_ACTION_OPTIONS)[number];

export interface JobWorkflowAction {
  id: JobActionId;
  /** Status the job is in when the action is performed (null for create actions). */
  atStatus: JobStatus | null;
  toStatus: JobStatus;
  phase: JobPhase;
  /** Application user roles allowed to perform the action. */
  roles: readonly UserRole[];
  /** Job module assignment required (e.g. editor, reviewer). */
  assignmentRoles?: readonly JobAssignmentRole[];
  createEntry?: boolean;
}

export interface JobCrossCuttingAction {
  id: 'reject_job' | 'delete_job';
  toStatus: JobStatus;
  roles: readonly UserRole[];
  fromStatuses: readonly JobStatus[];
}

/** §4.3 — Statuses grouped under each phase per swimlane diagram. */
export const JOB_PHASE_STATUSES: Record<JobPhase, readonly JobStatus[]> = {
  requested: ['new', 'approved'],
  scheduled: ['pending', 'assigned'],
  in_progress: ['finished', 'edited', 'in_review', 'reviewed'],
  completed: ['published', 'reconciled', 'invoiced'],
  cancelled: ['rejected', 'deleted'],
};

/** Primary phase for each status (§4.3). */
export const JOB_STATUS_PHASE: Record<JobStatus, JobPhase> = {
  new: 'requested',
  approved: 'requested',
  pending: 'scheduled',
  assigned: 'scheduled',
  finished: 'in_progress',
  edited: 'in_progress',
  in_review: 'in_progress',
  reviewed: 'in_progress',
  published: 'completed',
  reconciled: 'completed',
  invoiced: 'completed',
  rejected: 'cancelled',
  deleted: 'cancelled',
};

/** Allowed next statuses in the main job workflow (§4.2 / §4.3). */
export const JOB_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  new: ['approved', 'rejected', 'deleted'],
  approved: ['pending', 'rejected', 'deleted'],
  pending: ['assigned', 'rejected', 'deleted'],
  assigned: ['finished', 'deleted'],
  finished: ['edited', 'deleted'],
  edited: ['in_review', 'deleted'],
  in_review: ['reviewed', 'deleted'],
  reviewed: ['published', 'deleted'],
  published: ['reconciled', 'deleted'],
  reconciled: ['invoiced', 'deleted'],
  invoiced: [],
  rejected: [],
  deleted: [],
};

/** §4.3 — Primary workflow actions mapped to phases, statuses, and roles. */
export const JOB_WORKFLOW_ACTIONS: readonly JobWorkflowAction[] = [
  {
    id: 'add_new_job',
    atStatus: null,
    toStatus: 'new',
    phase: 'requested',
    roles: ['district_admin'],
    createEntry: true,
  },
  {
    id: 'approve_job',
    atStatus: 'new',
    toStatus: 'approved',
    phase: 'requested',
    roles: ['coordinator'],
  },
  {
    id: 'add_new_job_manager',
    atStatus: null,
    toStatus: 'pending',
    phase: 'scheduled',
    roles: ['coordinator', 'manager'],
    createEntry: true,
  },
  {
    id: 'provisionally_assign_job',
    atStatus: 'approved',
    toStatus: 'pending',
    phase: 'scheduled',
    roles: ['manager'],
  },
  {
    id: 'confirm_job_assignment',
    atStatus: 'pending',
    toStatus: 'assigned',
    phase: 'scheduled',
    roles: ['manager'],
  },
  {
    id: 'add_new_job_assign_self',
    atStatus: null,
    toStatus: 'assigned',
    phase: 'scheduled',
    roles: ['stenotypist'],
    createEntry: true,
  },
  {
    id: 'upload_raw_data_attachments',
    atStatus: 'assigned',
    toStatus: 'finished',
    phase: 'in_progress',
    roles: ['stenotypist'],
    assignmentRoles: ['stenotypist'],
  },
  {
    id: 'edit_submit_transcript_for_review',
    atStatus: 'finished',
    toStatus: 'edited',
    phase: 'in_progress',
    roles: ['stenotypist'],
    assignmentRoles: ['editor'],
  },
  {
    id: 'pick_transcript_for_review',
    atStatus: 'edited',
    toStatus: 'in_review',
    phase: 'in_progress',
    roles: ['stenotypist'],
    assignmentRoles: ['reviewer'],
  },
  {
    id: 'submit_reviewed_transcript',
    atStatus: 'in_review',
    toStatus: 'reviewed',
    phase: 'in_progress',
    roles: ['stenotypist'],
    assignmentRoles: ['reviewer'],
  },
  {
    id: 'publish_transcript',
    atStatus: 'reviewed',
    toStatus: 'published',
    phase: 'completed',
    roles: ['manager'],
  },
  {
    id: 'reconcile_receipt_data',
    atStatus: 'published',
    toStatus: 'reconciled',
    phase: 'completed',
    roles: ['manager', 'reconciliator'],
  },
  {
    id: 'generate_invoices',
    atStatus: 'reconciled',
    toStatus: 'invoiced',
    phase: 'completed',
    roles: ['accountant'],
  },
];

export const JOB_CROSS_CUTTING_ACTIONS: readonly JobCrossCuttingAction[] = [
  {
    id: 'reject_job',
    toStatus: 'rejected',
    roles: ['coordinator', 'manager'],
    fromStatuses: ['new', 'approved', 'pending'],
  },
  {
    id: 'delete_job',
    toStatus: 'deleted',
    roles: ['district_admin', 'coordinator', 'manager', 'stenotypist'],
    fromStatuses: [
      'new',
      'approved',
      'pending',
      'assigned',
      'finished',
      'edited',
      'in_review',
      'reviewed',
      'published',
      'reconciled',
    ],
  },
];

export const JOB_STATUS_WORKFLOW_ORDER: readonly JobStatus[] = [
  'new',
  'approved',
  'pending',
  'assigned',
  'finished',
  'edited',
  'in_review',
  'reviewed',
  'published',
  'reconciled',
  'invoiced',
  'rejected',
  'deleted',
];

export const JOB_PHASE_ORDER: readonly JobPhase[] = [
  'requested',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];
