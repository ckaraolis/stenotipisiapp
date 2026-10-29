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
import { TRAVELLING_CHARGES_OPTIONS } from './customers.js';
import { computeSystemTravellingChargeAmountForJob } from './jobTravellingCharges.js';
import { findDistrictById } from './districts.js';
import { findUserById, listUsers } from './db.js';
import { syncProjectJobReferences } from './jobReferences.js';
import {
  canPerformJobWorkflowAction,
  getCrossCuttingActionsForStatus,
  normalizeJobStatus,
} from './jobCatalog.js';

export { normalizeJobStatus } from './jobCatalog.js';
import { queueNotification } from './notifications.js';
import { findProjectById, findProjectRecordById } from './projects.js';
import {
  assertCustomerOrganisationJobMutation,
  assertCustomerOrganisationProjectAccess,
  assertManagerJobMutation,
  assertStenotypistJobMutation,
  canAccessJobRecord,
  filterJobsForActor,
  isCoordinatorActor,
  isDistrictAdminActor,
  isManagerActor,
  isStenotypistActor,
} from './jobAccess.js';
import { isStenotypistOnApprovedLeave } from './stenotypistLeaves.js';
import { normalizeRoles } from './roles.js';

const JOBS_PATH = path.join(DB_DIR, 'jobs.json');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const JOB_NUMBER_PATTERN = /^JB\d{6}$/;
const RECEIPT_NUMBER_PATTERN = /^\d{5}$/;

/** §4.4 — Reconciliation status options. */
export const JOB_RECONCILIATION_STATUS_OPTIONS = ['pending', 'correct', 'errors'];

/** §4.5 — Hardcoded rejection reason options. */
export const JOB_REJECTION_REASON_OPTIONS = [
  'scheduling_conflict',
  'resource_unavailable',
  'customer_cancelled',
  'insufficient_information',
  'other',
];

const REMARKS_MAX_LENGTH = 1000;

function readJobsFile() {
  ensureCollectionFile('jobs', { jobs: [] });
  return readCollection('jobs', { jobs: [] });
}

function writeJobsFile(data) {
  writeCollection('jobs', data);
}

function generateJobId() {
  return `job-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeJobDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    return '';
  }
  const date = value.trim();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return '';
  }
  return date;
}

export function normalizeJobTime(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value.trim())) {
    return '';
  }
  return value.trim();
}

export function normalizeOptionalJobTime(value) {
  if (value === null || value === undefined || value === '') return '';
  return normalizeJobTime(value);
}

export function normalizeReceiptNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = typeof value === 'number' ? String(value).padStart(5, '0') : String(value).trim();
  return RECEIPT_NUMBER_PATTERN.test(text) ? text : '';
}

export function normalizeTravellingChargesValue(value) {
  if (typeof value !== 'string') return 'non_billable';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return TRAVELLING_CHARGES_OPTIONS.includes(normalized) ? normalized : 'non_billable';
}

/** §4.4 / §2.1 — Travelling charge amounts stored as EUR (2 dp); legacy enum values migrate to 0. */
export function normalizeJobTravellingChargeAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value * 100) / 100;
  }
  const text = String(value).trim();
  if (!text) return 0;
  const legacy = text.toLowerCase().replace(/\s+/g, '_');
  if (TRAVELLING_CHARGES_OPTIONS.includes(legacy)) return 0;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

export function normalizeJobTravellingKm(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

export function normalizeJobTravellingKmRate(value) {
  return normalizeJobTravellingKm(value);
}

export function normalizeReconciliationStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return JOB_RECONCILIATION_STATUS_OPTIONS.includes(status) ? status : 'pending';
}

export function normalizeRejectionReason(value) {
  const reason = typeof value === 'string' ? value.trim() : '';
  return JOB_REJECTION_REASON_OPTIONS.includes(reason) ? reason : '';
}

function isManagerOrSuperAdmin(actor) {
  const roles = normalizeRoles(actor);
  return roles.includes('manager') || roles.includes('super_admin');
}

function userIsStenotypist(userId) {
  const user = findUserById(userId);
  if (!user || user.status !== 'active') return false;
  return normalizeRoles(user).includes('stenotypist');
}

function generateJobNumber(jobs) {
  let max = 0;
  for (const job of jobs ?? []) {
    const match = JOB_NUMBER_PATTERN.exec(job.jobNumber ?? '');
    if (match) {
      max = Math.max(max, Number(job.jobNumber.slice(2)));
    }
  }
  return `JB${String(max + 1).padStart(6, '0')}`;
}

function migrateJobRecord(job) {
  const now = new Date().toISOString();
  return {
    id: job.id ?? generateJobId(),
    jobNumber: JOB_NUMBER_PATTERN.test(job.jobNumber ?? '') ? job.jobNumber : '',
    ownerUserId: typeof job.ownerUserId === 'string' ? job.ownerUserId.trim() : '',
    projectId: typeof job.projectId === 'string' ? job.projectId.trim() : '',
    date: normalizeJobDate(job.date),
    time: normalizeJobTime(job.time),
    stenotypistUserId:
      typeof job.stenotypistUserId === 'string' ? job.stenotypistUserId.trim() : '',
    locationDetails: typeof job.locationDetails === 'string' ? job.locationDetails.trim() : '',
    districtId: typeof job.districtId === 'string' ? job.districtId.trim() : '',
    status: normalizeJobStatus(job.status) || 'new',
    remarks: typeof job.remarks === 'string' ? job.remarks.trim().slice(0, REMARKS_MAX_LENGTH) : '',
    expedite: job.expedite === true,
    rejectionReason: normalizeRejectionReason(job.rejectionReason),
    receiptNumberStenotypist: normalizeReceiptNumber(job.receiptNumberStenotypist),
    startTimeStenotypist: normalizeOptionalJobTime(job.startTimeStenotypist),
    endTimeStenotypist: normalizeOptionalJobTime(job.endTimeStenotypist),
    travellingChargesSystem: normalizeJobTravellingChargeAmount(job.travellingChargesSystem),
    receiptNumberAdministrator: normalizeReceiptNumber(job.receiptNumberAdministrator),
    startTimeAdministrator: normalizeOptionalJobTime(job.startTimeAdministrator),
    endTimeAdministrator: normalizeOptionalJobTime(job.endTimeAdministrator),
    travellingChargesAdministrator: normalizeJobTravellingChargeAmount(
      job.travellingChargesAdministrator,
    ),
    travellingKm: normalizeJobTravellingKm(job.travellingKm),
    travellingKmRate: normalizeJobTravellingKmRate(job.travellingKmRate),
    reconciliationStatus: normalizeReconciliationStatus(job.reconciliationStatus),
    proformaNumber: typeof job.proformaNumber === 'string' ? job.proformaNumber.trim() : '',
    createdAt: job.createdAt ?? now,
    updatedAt: job.updatedAt ?? now,
  };
}

export function migrateJobs() {
  const data = readJobsFile();
  let changed = false;
  const usedNumbers = new Set();

  data.jobs = (data.jobs ?? []).map((job) => {
    const migrated = migrateJobRecord(job);
    if (!migrated.jobNumber || usedNumbers.has(migrated.jobNumber)) {
      migrated.jobNumber = '';
      changed = true;
    }
    if (!migrated.jobNumber) {
      migrated.jobNumber = generateJobNumber(data.jobs.filter((row) => row.id !== migrated.id));
      changed = true;
    }
    usedNumbers.add(migrated.jobNumber);
    if (!migrated.districtId && migrated.projectId) {
      migrated.districtId = resolveDistrictIdFromProject(migrated.projectId);
      changed = true;
    }
    if (JSON.stringify(migrated) !== JSON.stringify(job)) {
      changed = true;
    }
    return migrated;
  });

  if (changed) {
    writeJobsFile(data);
  }
  return data;
}

export function ensureJobsDatabase() {
  ensureCollectionFile('jobs', { jobs: [] });
  migrateJobs();
}

function resolveDistrictIdFromProject(projectId) {
  const project = findProjectById(projectId);
  return project?.districtId ?? '';
}

function resolveDistrictId(projectId, inputDistrictId = '') {
  const explicit =
    typeof inputDistrictId === 'string' && inputDistrictId.trim() ? inputDistrictId.trim() : '';
  if (explicit) {
    const district = findDistrictById(explicit);
    if (!district || district.enabled === false) {
      return { error: 'jobDistrictInvalid' };
    }
    return explicit;
  }
  return resolveDistrictIdFromProject(projectId);
}

function listActiveUsersWithRoles(roleNames) {
  return listUsers().filter(
    (user) =>
      user.status === 'active' && normalizeRoles(user).some((role) => roleNames.includes(role)),
  );
}

function notifyJobCreated(job, actor) {
  const message = `New job ${job.jobNumber} has been submitted for ${job.date} at ${job.time}.`;
  for (const user of listActiveUsersWithRoles(['coordinator', 'manager'])) {
    queueNotification({
      type: 'job_created',
      message,
      targetUserId: user.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/jobs-steno',
      entityType: 'job',
      entityId: job.id,
    });
  }
}

function notifyStenotypistAssigned(job, actor) {
  if (!job.stenotypistUserId) return;
  queueNotification({
    type: 'job_assigned',
    message: `You have been assigned to job ${job.jobNumber} on ${job.date} at ${job.time}.`,
    targetUserId: job.stenotypistUserId,
    createdByUserId: actor?.id ?? null,
    actionPath: '/scheduling/jobs-steno',
    entityType: 'job',
    entityId: job.id,
  });
}

function notifyStenotypistUnassigned(job, previousStenotypistUserId, actor) {
  if (!previousStenotypistUserId) return;
  queueNotification({
    type: 'job_unassigned',
    message: `You are no longer assigned to job ${job.jobNumber} on ${job.date} at ${job.time}.`,
    targetUserId: previousStenotypistUserId,
    createdByUserId: actor?.id ?? null,
    actionPath: '/scheduling/jobs-steno',
    entityType: 'job',
    entityId: job.id,
  });
}

function notifyJobUpdated(job, existing, actor) {
  if (job.stenotypistUserId && job.stenotypistUserId !== existing.stenotypistUserId) {
    notifyStenotypistAssigned(job, actor);
  }
}

function getActorAssignmentRoles(job, actor) {
  const assignmentRoles = [];
  if (job.stenotypistUserId && actor?.id === job.stenotypistUserId) {
    assignmentRoles.push('stenotypist');
  }
  return assignmentRoles;
}

function notifyJobProvisionallyAssigned(job, actor) {
  const message = `Job ${job.jobNumber} has been assigned to a stenotypist and is pending confirmation.`;
  for (const user of listActiveUsersWithRoles(['coordinator', 'manager'])) {
    queueNotification({
      type: 'job_provisionally_assigned',
      message,
      targetUserId: user.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/job-allocation',
      entityType: 'job',
      entityId: job.id,
    });
  }
}

function notifyJobApproved(job, actor) {
  queueNotification({
    type: 'job_approved',
    message: `Job ${job.jobNumber} has been approved.`,
    targetUserId: job.ownerUserId || null,
    createdByUserId: actor?.id ?? null,
    actionPath: '/scheduling/jobs-steno',
    entityType: 'job',
    entityId: job.id,
  });
}

function notifyJobRejected(job, actor) {
  const message = `Job ${job.jobNumber} has been rejected.`;
  queueNotification({
    type: 'job_rejected',
    message,
    targetUserId: job.ownerUserId || null,
    createdByUserId: actor?.id ?? null,
    actionPath: '/scheduling/jobs-steno',
    entityType: 'job',
    entityId: job.id,
  });
  if (job.stenotypistUserId) {
    queueNotification({
      type: 'job_rejected',
      message,
      targetUserId: job.stenotypistUserId,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/jobs-steno',
      entityType: 'job',
      entityId: job.id,
    });
  }
}

function notifyJobConfirmed(job, actor) {
  if (job.stenotypistUserId) {
    notifyStenotypistAssigned(job, actor);
  }
  for (const user of listActiveUsersWithRoles(['coordinator', 'manager'])) {
    queueNotification({
      type: 'job_confirmed',
      message: `Job ${job.jobNumber} assignment has been confirmed.`,
      targetUserId: user.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/job-allocation',
      entityType: 'job',
      entityId: job.id,
    });
  }
}

function notifyConfirmAllJobs(jobs, actor) {
  const count = jobs.length;
  const message = `${count} pending job${count === 1 ? '' : 's'} confirmed and assigned.`;
  for (const user of listActiveUsersWithRoles(['coordinator', 'manager'])) {
    queueNotification({
      type: 'jobs_confirmed_all',
      message,
      targetUserId: user.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/job-allocation',
    });
  }
  for (const job of jobs) {
    if (job.stenotypistUserId) {
      notifyStenotypistAssigned(job, actor);
    }
  }
}

export function buildJobUpdatePayload(job, overrides = {}) {
  return {
    projectId: job.projectId,
    districtId: job.districtId,
    date: job.date,
    time: job.time,
    stenotypistUserId: job.stenotypistUserId ?? '',
    locationDetails: job.locationDetails,
    remarks: job.remarks,
    expedite: job.expedite,
    status: job.status,
    rejectionReason: job.rejectionReason,
    receiptNumberStenotypist: job.receiptNumberStenotypist,
    startTimeStenotypist: job.startTimeStenotypist,
    endTimeStenotypist: job.endTimeStenotypist,
    travellingChargesSystem: job.travellingChargesSystem,
    receiptNumberAdministrator: job.receiptNumberAdministrator,
    startTimeAdministrator: job.startTimeAdministrator,
    endTimeAdministrator: job.endTimeAdministrator,
    travellingChargesAdministrator: job.travellingChargesAdministrator,
    travellingKm: job.travellingKm ?? 0,
    travellingKmRate: job.travellingKmRate ?? 0,
    reconciliationStatus: job.reconciliationStatus,
    proformaNumber: job.proformaNumber,
    ...overrides,
  };
}

function assertWorkflowAction(job, actor, actionId) {
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  const allowed = canPerformJobWorkflowAction(actionId, {
    status: job.status,
    userOrRoles: actor,
    assignmentRoles: getActorAssignmentRoles(job, actor),
  });
  if (!allowed) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

function assertCrossCuttingAction(job, actor, actionId) {
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  const allowed = getCrossCuttingActionsForStatus(job.status, actor).some(
    (action) => action.id === actionId,
  );
  if (!allowed) {
    return { errors: ['jobActionNotAllowed'] };
  }
  return null;
}

export function listJobStenotypistCandidates() {
  return listUsers()
    .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
}

function toPublicUser(userId) {
  const user = findUserById(userId);
  if (!user) {
    return { id: userId, fullName: '', username: '' };
  }
  return {
    id: user.id,
    fullName: user.fullName ?? '',
    username: user.username ?? '',
  };
}

export function toPublicJob(job) {
  const project = findProjectRecordById(job.projectId);
  const district = findDistrictById(job.districtId);
  const owner = toPublicUser(job.ownerUserId);
  const stenotypist = job.stenotypistUserId ? toPublicUser(job.stenotypistUserId) : null;

  return {
    id: job.id,
    jobNumber: job.jobNumber,
    ownerUserId: job.ownerUserId,
    ownerName: owner.fullName,
    ownerUsername: owner.username,
    projectId: job.projectId,
    projectNumber: project?.projectNumber ?? '',
    customerId: project?.customerId ?? '',
    customerName: project?.customerName ?? '',
    customerAlias: project?.customerAlias ?? '',
    projectField1: project?.field1Value ?? '',
    projectField2: project?.field2Value ?? '',
    projectField3: project?.field3 ?? '',
    projectField4: project?.field4 ?? '',
    projectTravellingCharges: project?.travellingCharges ?? 'non_billable',
    date: job.date,
    time: job.time,
    stenotypistUserId: job.stenotypistUserId,
    stenotypistName: stenotypist?.fullName ?? '',
    stenotypistUsername: stenotypist?.username ?? '',
    stenotypistAlias: stenotypist?.username ?? '',
    locationDetails: job.locationDetails,
    districtId: job.districtId,
    districtName: district?.name ?? project?.districtName ?? '',
    districtAlias: district?.alias ?? project?.districtAlias ?? '',
    status: job.status,
    remarks: job.remarks,
    expedite: job.expedite,
    rejectionReason: job.rejectionReason,
    receiptNumberStenotypist: job.receiptNumberStenotypist,
    startTimeStenotypist: job.startTimeStenotypist,
    endTimeStenotypist: job.endTimeStenotypist,
    travellingChargesSystem: job.travellingChargesSystem,
    receiptNumberAdministrator: job.receiptNumberAdministrator,
    startTimeAdministrator: job.startTimeAdministrator,
    endTimeAdministrator: job.endTimeAdministrator,
    travellingChargesAdministrator: job.travellingChargesAdministrator,
    travellingKm: job.travellingKm ?? 0,
    travellingKmRate: job.travellingKmRate ?? 0,
    reconciliationStatus: job.reconciliationStatus,
    proformaNumber: job.proformaNumber,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function listJobRecords(actor = null) {
  const data = readJobsFile();
  const jobs = (data.jobs ?? []).map(toPublicJob);
  const scoped = actor ? filterJobsForActor(jobs, actor) : jobs;
  return scoped.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.time.localeCompare(b.time) ||
        a.jobNumber.localeCompare(b.jobNumber),
    );
}

export function findJobById(jobId) {
  if (!jobId) return null;
  const data = readJobsFile();
  return data.jobs.find((row) => row.id === jobId) ?? null;
}

export function listJobsByProjectId(projectId) {
  if (!projectId) return [];
  const data = readJobsFile();
  return (data.jobs ?? []).filter((row) => row.projectId === projectId);
}

export function findJobRecordById(jobId) {
  const job = findJobById(jobId);
  if (!job) return null;
  return toPublicJob(job);
}

function validateTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return true;
  return startTime <= endTime;
}

function validateJobInput(input, { existingId = null, existingJob = null } = {}) {
  const errors = [];
  const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
  const date = normalizeJobDate(input.date);
  const time = normalizeJobTime(input.time);
  const stenotypistUserId =
    typeof input.stenotypistUserId === 'string' ? input.stenotypistUserId.trim() : '';
  const locationDetails =
    typeof input.locationDetails === 'string' ? input.locationDetails.trim() : '';
  const status = normalizeJobStatus(input.status) || existingJob?.status || 'new';
  const remarks =
    typeof input.remarks === 'string' ? input.remarks.trim().slice(0, REMARKS_MAX_LENGTH) : '';
  const rejectionReason = normalizeRejectionReason(input.rejectionReason);
  const receiptNumberStenotypist = normalizeReceiptNumber(input.receiptNumberStenotypist);
  const receiptNumberAdministrator = normalizeReceiptNumber(input.receiptNumberAdministrator);
  const startTimeStenotypist = normalizeOptionalJobTime(input.startTimeStenotypist);
  const endTimeStenotypist = normalizeOptionalJobTime(input.endTimeStenotypist);
  const startTimeAdministrator = normalizeOptionalJobTime(input.startTimeAdministrator);
  const endTimeAdministrator = normalizeOptionalJobTime(input.endTimeAdministrator);

  if (!projectId) {
    errors.push('jobProjectRequired');
  } else if (!findProjectById(projectId)) {
    errors.push('jobProjectInvalid');
  }

  if (!date) errors.push('jobDateRequired');
  if (!time) errors.push('jobTimeRequired');

  if (stenotypistUserId && !userIsStenotypist(stenotypistUserId)) {
    errors.push('jobStenotypistInvalid');
  }

  if (stenotypistUserId && date && isStenotypistOnApprovedLeave(stenotypistUserId, date)) {
    errors.push('jobStenotypistOnApprovedLeave');
  }

  if (input.receiptNumberStenotypist && !receiptNumberStenotypist) {
    errors.push('jobReceiptNumberStenotypistInvalid');
  }
  if (input.receiptNumberAdministrator && !receiptNumberAdministrator) {
    errors.push('jobReceiptNumberAdministratorInvalid');
  }
  if (input.startTimeStenotypist && !startTimeStenotypist) errors.push('jobStartTimeStenotypistInvalid');
  if (input.endTimeStenotypist && !endTimeStenotypist) errors.push('jobEndTimeStenotypistInvalid');
  if (input.startTimeAdministrator && !startTimeAdministrator) {
    errors.push('jobStartTimeAdministratorInvalid');
  }
  if (input.endTimeAdministrator && !endTimeAdministrator) {
    errors.push('jobEndTimeAdministratorInvalid');
  }
  if (!validateTimeRange(startTimeStenotypist, endTimeStenotypist)) {
    errors.push('jobStenotypistTimeRangeInvalid');
  }
  if (!validateTimeRange(startTimeAdministrator, endTimeAdministrator)) {
    errors.push('jobAdministratorTimeRangeInvalid');
  }

  if (status === 'rejected' && !rejectionReason) {
    errors.push('jobRejectionReasonRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const districtResult = resolveDistrictId(projectId, input.districtId);
  if (districtResult && typeof districtResult === 'object' && districtResult.error) {
    return { errors: [districtResult.error] };
  }
  const districtId = typeof districtResult === 'string' ? districtResult : '';

  return {
    value: {
      projectId,
      date,
      time,
      stenotypistUserId,
      locationDetails,
      districtId,
      status,
      remarks,
      expedite: input.expedite === true,
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      receiptNumberStenotypist,
      startTimeStenotypist,
      endTimeStenotypist,
      travellingChargesSystem: normalizeJobTravellingChargeAmount(input.travellingChargesSystem),
      receiptNumberAdministrator,
      startTimeAdministrator,
      endTimeAdministrator,
      travellingChargesAdministrator: normalizeJobTravellingChargeAmount(
        input.travellingChargesAdministrator,
      ),
      travellingKm: normalizeJobTravellingKm(input.travellingKm),
      travellingKmRate: normalizeJobTravellingKmRate(input.travellingKmRate),
      reconciliationStatus: normalizeReconciliationStatus(input.reconciliationStatus),
      proformaNumber: typeof input.proformaNumber === 'string' ? input.proformaNumber.trim() : '',
    },
  };
}

export function createJob(input, actor) {
  if (isStenotypistActor(actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const validation = validateJobInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const project = findProjectRecordById(validation.value.projectId);
  const districtDenied = assertCustomerOrganisationProjectAccess(project, actor);
  if (districtDenied) {
    return districtDenied;
  }

  const data = readJobsFile();
  const now = new Date().toISOString();
  const jobValue = { ...validation.value };
  if (!isManagerOrSuperAdmin(actor)) {
    jobValue.stenotypistUserId = '';
  }
  const job = {
    id: generateJobId(),
    jobNumber: generateJobNumber(data.jobs),
    ownerUserId: actor?.id ?? '',
    ...jobValue,
    createdAt: now,
    updatedAt: now,
  };

  data.jobs.push(job);
  writeJobsFile(data);
  notifyJobCreated(job, actor);
  if (job.stenotypistUserId) {
    notifyStenotypistAssigned(job, actor);
  }
  return { job: toPublicJob(job) };
}

export function updateJob(jobId, input, actor) {
  const data = readJobsFile();
  const index = (data.jobs ?? []).findIndex((row) => row.id === jobId);
  if (index === -1) {
    return { errors: ['jobNotFound'] };
  }

  const existing = data.jobs[index];
  const existingPublic = toPublicJob(existing);
  if (!canAccessJobRecord(existingPublic, actor)) {
    return { errors: ['jobNotFound'] };
  }

  const validation = validateJobInput(input, { existingId: jobId, existingJob: existing });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const districtAction =
    validation.value.status === 'deleted' && existing.status !== 'deleted' ? 'delete' : 'edit';
  const districtDenied = assertCustomerOrganisationJobMutation(existingPublic, actor, districtAction);
  if (districtDenied) {
    return districtDenied;
  }

  const managerDenied = assertManagerJobMutation(existingPublic, actor, districtAction);
  if (managerDenied) {
    return managerDenied;
  }

  const stenotypistDenied = assertStenotypistJobMutation(existingPublic, actor, districtAction);
  if (stenotypistDenied) {
    return stenotypistDenied;
  }

  const project = findProjectRecordById(validation.value.projectId);
  const projectDenied = assertCustomerOrganisationProjectAccess(project, actor);
  if (projectDenied) {
    return projectDenied;
  }

  const nextStenotypist = validation.value.stenotypistUserId;
  if (
    !isManagerOrSuperAdmin(actor) &&
    nextStenotypist !== (existing.stenotypistUserId ?? '')
  ) {
    return { errors: ['jobStenotypistChangeForbidden'] };
  }

  let jobValue = validation.value;
  if (isStenotypistActor(actor) && districtAction === 'edit') {
    jobValue = {
      ...jobValue,
      projectId: existing.projectId,
      date: existing.date,
      time: existing.time,
      locationDetails: existing.locationDetails,
      districtId: existing.districtId ?? '',
      expedite: existing.expedite,
      stenotypistUserId: existing.stenotypistUserId ?? '',
      status: existing.status,
      rejectionReason: existing.rejectionReason ?? '',
    };
  }

  const updated = {
    ...existing,
    ...jobValue,
    stenotypistUserId: isManagerOrSuperAdmin(actor)
      ? jobValue.stenotypistUserId
      : existing.stenotypistUserId,
    updatedAt: new Date().toISOString(),
  };

  data.jobs[index] = updated;
  writeJobsFile(data);
  notifyJobUpdated(updated, existing, actor);
  return { job: toPublicJob(updated) };
}

export function approveJob(jobId, actor) {
  const job = findJobById(jobId);
  const denied = assertWorkflowAction(job, actor, 'approve_job');
  if (denied) return denied;

  const result = updateJob(jobId, buildJobUpdatePayload(job, { status: 'approved' }), actor);
  if (!result.errors) {
    notifyJobApproved(job, actor);
  }
  return result;
}

export function rejectJob(jobId, input, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }

  const jobPublic = toPublicJob(job);
  if (isCoordinatorActor(actor)) {
    const coordinatorDenied = assertCustomerOrganisationJobMutation(jobPublic, actor, 'reject');
    if (coordinatorDenied) return coordinatorDenied;
  } else if (isManagerActor(actor)) {
    const managerDenied = assertManagerJobMutation(jobPublic, actor, 'reject');
    if (managerDenied) return managerDenied;
  } else {
    const denied = assertCrossCuttingAction(job, actor, 'reject_job');
    if (denied) return denied;
  }

  const rejectionReason = normalizeRejectionReason(input?.rejectionReason);
  const result = updateJob(
    jobId,
    buildJobUpdatePayload(job, { status: 'rejected', rejectionReason }),
    actor,
  );
  if (!result.errors) {
    notifyJobRejected(job, actor);
  }
  return result;
}

export function assignJob(jobId, input, actor) {
  const job = findJobById(jobId);
  const denied = assertWorkflowAction(job, actor, 'provisionally_assign_job');
  if (denied) return denied;

  const stenotypistUserId =
    typeof input?.stenotypistUserId === 'string' ? input.stenotypistUserId.trim() : '';
  if (!stenotypistUserId) {
    return { errors: ['jobStenotypistRequired'] };
  }
  if (!userIsStenotypist(stenotypistUserId)) {
    return { errors: ['jobStenotypistInvalid'] };
  }

  const result = updateJob(
    jobId,
    buildJobUpdatePayload(job, { status: 'pending', stenotypistUserId }),
    actor,
  );
  if (!result.errors) {
    notifyJobProvisionallyAssigned(result.job, actor);
  }
  return result;
}

export function confirmJob(jobId, actor) {
  const job = findJobById(jobId);
  const denied = assertWorkflowAction(job, actor, 'confirm_job_assignment');
  if (denied) return denied;

  const result = updateJob(jobId, buildJobUpdatePayload(job, { status: 'assigned' }), actor);
  if (!result.errors) {
    notifyJobConfirmed(result.job, actor);
  }
  return result;
}

export function confirmAllPendingJobs(actor) {
  if (isDistrictAdminActor(actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const data = readJobsFile();
  const pendingJobs = (data.jobs ?? []).filter((row) => row.status === 'pending');
  const confirmed = [];

  for (const job of pendingJobs) {
    const denied = assertWorkflowAction(job, actor, 'confirm_job_assignment');
    if (denied) continue;
    const result = updateJob(job.id, buildJobUpdatePayload(job, { status: 'assigned' }), actor);
    if (!result.errors) {
      confirmed.push(result.job);
    }
  }

  if (confirmed.length === 0) {
    return { errors: ['jobConfirmAllNone'] };
  }

  notifyConfirmAllJobs(confirmed, actor);
  return { jobs: confirmed, count: confirmed.length };
}

export function deleteJob(jobId, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }

  const jobPublic = toPublicJob(job);
  if (!canAccessJobRecord(jobPublic, actor)) {
    return { errors: ['jobNotFound'] };
  }

  if (isDistrictAdminActor(actor)) {
    const districtDenied = assertCustomerOrganisationJobMutation(jobPublic, actor, 'delete');
    if (districtDenied) return districtDenied;
  } else if (isCoordinatorActor(actor)) {
    const coordinatorDenied = assertCustomerOrganisationJobMutation(jobPublic, actor, 'delete');
    if (coordinatorDenied) return coordinatorDenied;
  } else if (isManagerActor(actor)) {
    const managerDenied = assertManagerJobMutation(jobPublic, actor, 'delete');
    if (managerDenied) return managerDenied;
  } else if (isStenotypistActor(actor)) {
    const stenotypistDenied = assertStenotypistJobMutation(jobPublic, actor, 'delete');
    if (stenotypistDenied) return stenotypistDenied;
  } else {
    const denied = assertCrossCuttingAction(job, actor, 'delete_job');
    if (denied) return denied;
  }

  return updateJob(jobId, buildJobUpdatePayload(job, { status: 'deleted' }), actor);
}

const MATRIX_SCHEDULE_DRAG_STATUSES = new Set(['approved', 'pending', 'assigned']);

export function matrixAllocateJob(jobId, input, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (!isManagerOrSuperAdmin(actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (!MATRIX_SCHEDULE_DRAG_STATUSES.has(job.status)) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const stenotypistUserId =
    typeof input?.stenotypistUserId === 'string' ? input.stenotypistUserId.trim() : '';
  const date = normalizeJobDate(input?.date);
  if (!stenotypistUserId) {
    return { errors: ['jobStenotypistRequired'] };
  }
  if (!date) {
    return { errors: ['jobDateRequired'] };
  }
  if (!userIsStenotypist(stenotypistUserId)) {
    return { errors: ['jobStenotypistInvalid'] };
  }
  if (isStenotypistOnApprovedLeave(stenotypistUserId, date)) {
    return { errors: ['jobStenotypistOnApprovedLeave'] };
  }

  if (job.status === 'approved' && !job.stenotypistUserId?.trim()) {
    const denied = assertWorkflowAction(job, actor, 'provisionally_assign_job');
    if (denied) return denied;

    const result = updateJob(
      jobId,
      buildJobUpdatePayload(job, { status: 'pending', stenotypistUserId, date }),
      actor,
    );
    if (!result.errors) {
      notifyJobProvisionallyAssigned(result.job, actor);
    }
    return result;
  }

  if (job.status === 'pending' || job.status === 'assigned') {
    const previousStenotypist = job.stenotypistUserId ?? '';
    const unchanged =
      previousStenotypist === stenotypistUserId && job.date === date;
    if (unchanged) {
      return { job: toPublicJob(job) };
    }

    const result = updateJob(
      jobId,
      buildJobUpdatePayload(job, { stenotypistUserId, date }),
      actor,
    );
    if (!result.errors) {
      if (previousStenotypist && previousStenotypist !== stenotypistUserId) {
        notifyStenotypistUnassigned(job, previousStenotypist, actor);
      }
      if (stenotypistUserId && stenotypistUserId !== previousStenotypist) {
        notifyStenotypistAssigned(result.job, actor);
      }
    }
    return result;
  }

  return { errors: ['jobActionNotAllowed'] };
}

export function matrixUnassignJob(jobId, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (!isManagerOrSuperAdmin(actor)) {
    return { errors: ['jobActionNotAllowed'] };
  }
  if (!['pending', 'assigned'].includes(job.status)) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const actionId = job.status === 'assigned' ? 'unassign_assigned_job' : 'unassign_job';
  const denied = assertWorkflowAction(job, actor, actionId);
  if (denied) return denied;

  const previousStenotypist = job.stenotypistUserId ?? '';
  const result = updateJob(
    jobId,
    buildJobUpdatePayload(job, { status: 'approved', stenotypistUserId: '' }),
    actor,
  );
  if (!result.errors && previousStenotypist) {
    notifyStenotypistUnassigned(job, previousStenotypist, actor);
  }
  return result;
}

/** §2.2 — Sync expedite / status from transcript details form without full workflow validation. */
export function patchJobFromTranscriptDetails(jobId, updates, actor) {
  const data = readJobsFile();
  const index = (data.jobs ?? []).findIndex((row) => row.id === jobId);
  if (index === -1) {
    return { errors: ['jobNotFound'] };
  }

  const existing = data.jobs[index];
  const existingPublic = toPublicJob(existing);
  if (!canAccessJobRecord(existingPublic, actor)) {
    return { errors: ['jobNotFound'] };
  }

  const next = { ...existing };
  if (typeof updates?.expedite === 'boolean') {
    next.expedite = updates.expedite;
  }
  if (typeof updates?.status === 'string' && updates.status.trim()) {
    const nextStatus = normalizeJobStatus(updates.status);
    if (nextStatus) {
      next.status = nextStatus;
      if (nextStatus === 'published' && existing.status !== 'published') {
        next.travellingChargesSystem = computeSystemTravellingChargeAmountForJob(next);
        next.reconciliationStatus = 'pending';
      }
    }
  }
  next.updatedAt = new Date().toISOString();
  data.jobs[index] = next;
  writeJobsFile(data);
  return { job: toPublicJob(next) };
}
