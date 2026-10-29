/** §4.1–§4.3 — Job phases, statuses, workflow, and role mappings. */

export const JOB_PHASES = [
  'requested',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export const JOB_STATUSES = [
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

export const JOB_ASSIGNMENT_ROLES = ['stenotypist', 'editor', 'reviewer'];

export const JOB_CUSTOMER_ROLES = ['district_admin', 'coordinator'];
export const JOB_ASTRAEA_ROLES = ['manager', 'stenotypist', 'reconciliator', 'accountant'];

export const JOB_PHASE_STATUSES = {
  requested: ['new', 'approved'],
  scheduled: ['pending', 'assigned'],
  in_progress: ['finished', 'edited', 'in_review', 'reviewed'],
  completed: ['published', 'reconciled', 'invoiced'],
  cancelled: ['rejected', 'deleted'],
};

export const JOB_STATUS_PHASE = {
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

export const JOB_STATUS_TRANSITIONS = {
  new: ['approved', 'rejected', 'deleted'],
  approved: ['pending', 'rejected', 'deleted'],
  pending: ['assigned', 'rejected', 'deleted', 'approved'],
  assigned: ['finished', 'deleted', 'approved'],
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

export const JOB_WORKFLOW_ACTIONS = [
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
    id: 'unassign_job',
    atStatus: 'pending',
    toStatus: 'approved',
    phase: 'requested',
    roles: ['manager'],
  },
  {
    id: 'unassign_assigned_job',
    atStatus: 'assigned',
    toStatus: 'approved',
    phase: 'requested',
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

export const JOB_CROSS_CUTTING_ACTIONS = [
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

export const JOB_STATUS_WORKFLOW_ORDER = [
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

export function isJobStatusBefore(status, marker) {
  const currentIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(status);
  const markerIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(marker);
  if (currentIndex === -1 || markerIndex === -1) return false;
  return currentIndex < markerIndex;
}

export function isJobStatusAfter(status, marker) {
  const currentIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(status);
  const markerIndex = JOB_STATUS_WORKFLOW_ORDER.indexOf(marker);
  if (currentIndex === -1 || markerIndex === -1) return false;
  return currentIndex > markerIndex;
}

export const JOB_PHASE_ORDER = [
  'requested',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export function normalizeJobPhase(value) {
  const phase = typeof value === 'string' ? value.trim() : '';
  return JOB_PHASES.includes(phase) ? phase : '';
}

export function normalizeJobStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return JOB_STATUSES.includes(status) ? status : '';
}

export function getPhaseForJobStatus(status) {
  const normalized = normalizeJobStatus(status);
  return normalized ? JOB_STATUS_PHASE[normalized] : null;
}

export function getStatusesForJobPhase(phase) {
  const normalized = normalizeJobPhase(phase);
  return normalized ? JOB_PHASE_STATUSES[normalized] : [];
}

export function getAllowedJobStatusTransitions(status) {
  const normalized = normalizeJobStatus(status);
  return normalized ? JOB_STATUS_TRANSITIONS[normalized] : [];
}

export function canTransitionJobStatus(from, to) {
  return getAllowedJobStatusTransitions(from).includes(to);
}

function normalizeRoles(userOrRoles) {
  if (!userOrRoles) return [];
  if (Array.isArray(userOrRoles)) return userOrRoles;
  if (typeof userOrRoles === 'string') return [userOrRoles];
  if (Array.isArray(userOrRoles.roles)) return userOrRoles.roles;
  if (userOrRoles.role) return [userOrRoles.role];
  return [];
}

function hasAnyRole(userOrRoles, allowedRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) return true;
  return allowedRoles.some((role) => roles.includes(role));
}

export function getWorkflowActionsForStatus(status) {
  const normalized = normalizeJobStatus(status);
  if (!normalized) return [];
  return JOB_WORKFLOW_ACTIONS.filter((action) => action.atStatus === normalized);
}

export function getCreateJobActions(userOrRoles) {
  return JOB_WORKFLOW_ACTIONS.filter(
    (action) => action.createEntry && hasAnyRole(userOrRoles, action.roles),
  );
}

export function getCrossCuttingActionsForStatus(status, userOrRoles) {
  const normalized = normalizeJobStatus(status);
  if (!normalized) return [];
  return JOB_CROSS_CUTTING_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(normalized) && hasAnyRole(userOrRoles, action.roles),
  );
}

export function canPerformJobWorkflowAction(
  actionId,
  { status = null, userOrRoles, assignmentRoles = [] } = {},
) {
  const action = JOB_WORKFLOW_ACTIONS.find((row) => row.id === actionId);
  if (!action) return false;
  if (!hasAnyRole(userOrRoles, action.roles)) return false;
  if (action.createEntry) return action.atStatus === null;
  if (normalizeJobStatus(status) !== action.atStatus) return false;
  if (!action.assignmentRoles?.length) return true;
  return action.assignmentRoles.every((role) => assignmentRoles.includes(role));
}

export function getJobCatalog() {
  return {
    phases: JOB_PHASES,
    statuses: JOB_STATUSES,
    phaseOrder: JOB_PHASE_ORDER,
    statusWorkflowOrder: JOB_STATUS_WORKFLOW_ORDER,
    phaseStatuses: JOB_PHASE_STATUSES,
    statusPhase: JOB_STATUS_PHASE,
    transitions: JOB_STATUS_TRANSITIONS,
    assignmentRoles: JOB_ASSIGNMENT_ROLES,
    customerRoles: JOB_CUSTOMER_ROLES,
    astraeaRoles: JOB_ASTRAEA_ROLES,
    workflowActions: JOB_WORKFLOW_ACTIONS,
    crossCuttingActions: JOB_CROSS_CUTTING_ACTIONS,
  };
}
