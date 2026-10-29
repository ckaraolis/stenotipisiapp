import { getPhaseForJobStatus } from './jobCatalog.js';
import { normalizeRoles } from './roles.js';

/** §4.11 — Roles with access to Job List and Details Form. */
export const JOB_LIST_ACCESS_ROLES = ['district_admin', 'coordinator', 'stenotypist', 'manager'];

const REQUESTED_OR_SCHEDULED_PHASES = new Set(['requested', 'scheduled']);

export function isDistrictAdminActor(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || roles.includes('manager') || roles.includes('coordinator')) {
    return false;
  }
  return roles.includes('district_admin');
}

export function isCoordinatorActor(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('coordinator');
}

export function isManagerActor(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin')) {
    return false;
  }
  return roles.includes('manager');
}

export function isStenotypistActor(actor) {
  const roles = normalizeRoles(actor);
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

export function isCustomerOrganisationActor(actor) {
  return isDistrictAdminActor(actor) || isCoordinatorActor(actor);
}

export function canAccessJobList(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('transcript_owner') && !roles.some((role) => JOB_LIST_ACCESS_ROLES.includes(role))) {
    return false;
  }
  if (roles.includes('super_admin')) return true;
  return roles.some((role) => JOB_LIST_ACCESS_ROLES.includes(role));
}

export function getActorCustomerId(actor) {
  return typeof actor?.customerId === 'string' ? actor.customerId.trim() : '';
}

export function jobMatchesActorCustomer(job, actor) {
  if (!isCustomerOrganisationActor(actor)) return true;
  const customerId = getActorCustomerId(actor);
  if (!customerId) return false;
  return job.customerId === customerId;
}

export function filterJobsForActor(jobs, actor) {
  /** §4.11.4.1 — Assigned jobs plus own created jobs (for delete). */
  if (isStenotypistActor(actor)) {
    const actorId = actor?.id ?? '';
    if (!actorId) return [];
    return jobs.filter(
      (job) => job.stenotypistUserId === actorId || job.ownerUserId === actorId,
    );
  }
  if (!isCustomerOrganisationActor(actor)) return jobs;
  const customerId = getActorCustomerId(actor);
  if (!customerId) return [];
  return jobs.filter((job) => job.customerId === customerId);
}

export function canAccessJobRecord(job, actor) {
  if (!job) return false;
  if (isStenotypistActor(actor)) {
    const actorId = actor?.id ?? '';
    if (!actorId) return false;
    return job.stenotypistUserId === actorId || job.ownerUserId === actorId;
  }
  return jobMatchesActorCustomer(job, actor);
}

function isStenotypistCreatorOrAssignee(job, actorId) {
  return job.ownerUserId === actorId || job.stenotypistUserId === actorId;
}

/** §4.11.4 — Stenotypist may edit jobs they created or are assigned to while status is Assigned. */
export function canStenotypistEditJob(job, actor) {
  if (!job || !actor?.id) return false;
  if (!isStenotypistCreatorOrAssignee(job, actor.id)) return false;
  return job.status === 'assigned';
}

/** §4.11.4 — Stenotypist may delete jobs they created. */
export function canStenotypistDeleteJob(job, actor) {
  if (!job || !actor?.id) return false;
  return job.ownerUserId === actor.id;
}

export function canDistrictAdminEditJob(job, actor) {
  if (!job || !actor?.id) return false;
  if (job.ownerUserId !== actor.id) return false;
  const phase = getPhaseForJobStatus(job.status);
  return REQUESTED_OR_SCHEDULED_PHASES.has(phase ?? '');
}

export function canDistrictAdminDeleteJob(job, actor) {
  if (!job || !actor?.id) return false;
  return job.ownerUserId === actor.id && job.status === 'new';
}

export function canCoordinatorEditJob(job, actor) {
  if (!jobMatchesActorCustomer(job, actor)) return false;
  const phase = getPhaseForJobStatus(job.status);
  return REQUESTED_OR_SCHEDULED_PHASES.has(phase ?? '');
}

export function canCoordinatorRejectJob(job, actor) {
  return canCoordinatorEditJob(job, actor);
}

export function canCoordinatorDeleteJob(job, actor) {
  if (!jobMatchesActorCustomer(job, actor)) return false;
  return getPhaseForJobStatus(job.status) === 'requested';
}

/** §4.11.3 — Manager may reject jobs in Requested or Scheduled phases. */
export function canManagerRejectJob(job) {
  const phase = getPhaseForJobStatus(job?.status);
  return REQUESTED_OR_SCHEDULED_PHASES.has(phase ?? '');
}

/** §4.11.3 — Manager may delete own jobs that have no stenotypist assigned. */
export function canManagerDeleteJob(job, actor) {
  if (!job || !actor?.id) return false;
  if (job.ownerUserId !== actor.id) return false;
  const stenotypistUserId =
    typeof job.stenotypistUserId === 'string' ? job.stenotypistUserId.trim() : '';
  return !stenotypistUserId;
}

export function assertDistrictAdminJobMutation(job, actor, action) {
  if (!isDistrictAdminActor(actor)) return null;
  if (!canAccessJobRecord(job, actor)) {
    return { errors: ['jobNotFound'] };
  }
  if (action === 'edit' && !canDistrictAdminEditJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (action === 'delete' && !canDistrictAdminDeleteJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

export function assertCoordinatorJobMutation(job, actor, action) {
  if (!isCoordinatorActor(actor)) return null;
  if (!canAccessJobRecord(job, actor)) {
    return { errors: ['jobNotFound'] };
  }
  if (action === 'edit' && !canCoordinatorEditJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (action === 'reject' && !canCoordinatorRejectJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (action === 'delete' && !canCoordinatorDeleteJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

export function assertManagerJobMutation(job, actor, action) {
  if (!isManagerActor(actor)) return null;
  if (action === 'reject' && !canManagerRejectJob(job)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (action === 'delete' && !canManagerDeleteJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

export function assertStenotypistJobMutation(job, actor, action) {
  if (!isStenotypistActor(actor)) return null;
  if (!canAccessJobRecord(job, actor)) {
    return { errors: ['jobNotFound'] };
  }
  if (action === 'edit' && !canStenotypistEditJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (action === 'delete' && !canStenotypistDeleteJob(job, actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

export function assertCustomerOrganisationJobMutation(job, actor, action) {
  const districtDenied = assertDistrictAdminJobMutation(job, actor, action);
  if (districtDenied) return districtDenied;
  return assertCoordinatorJobMutation(job, actor, action);
}

export function assertCustomerOrganisationProjectAccess(project, actor) {
  if (!isCustomerOrganisationActor(actor)) return null;
  const customerId = getActorCustomerId(actor);
  if (!customerId || !project || project.customerId !== customerId) {
    return { errors: ['jobProjectInvalid'] };
  }
  return null;
}

/** @deprecated Use assertCustomerOrganisationProjectAccess */
export function assertDistrictAdminProjectAccess(project, actor) {
  return assertCustomerOrganisationProjectAccess(project, actor);
}
