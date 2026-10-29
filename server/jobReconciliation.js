import { canPerformJobWorkflowAction, normalizeJobStatus } from './jobCatalog.js';
import {
  computeSystemTravellingChargeAmountForJob,
  getProjectTravellingChargesForJob,
  isBillableTravellingChargesMode,
} from './jobTravellingCharges.js';
import {
  buildJobUpdatePayload,
  findJobById,
  listJobRecords,
  normalizeJobDate,
  normalizeJobTravellingChargeAmount,
  normalizeJobTravellingKm,
  normalizeJobTravellingKmRate,
  normalizeOptionalJobTime,
  normalizeReceiptNumber,
  normalizeReconciliationStatus,
  toPublicJob,
  updateJob,
} from './jobs.js';
import { canAccessJobReconciliationModule } from './permissions.js';

const RECONCILIATION_LIST_STATUSES = new Set(['published', 'reconciled', 'invoiced']);

function assertReconciliationAccess(actor) {
  if (!canAccessJobReconciliationModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

/** §2.3 — Reconciliation status derived from administrator vs stenotypist/system values. */
export function computeReconciliationStatusForJob(job, systemAmount, projectTravellingCharges) {
  const receiptBlank = !job.receiptNumberAdministrator;
  const startBlank = !job.startTimeAdministrator;
  const endBlank = !job.endTimeAdministrator;
  const travellingAdmin = normalizeJobTravellingChargeAmount(job.travellingChargesAdministrator);
  const travellingBlank =
    isBillableTravellingChargesMode(projectTravellingCharges) && travellingAdmin <= 0;

  if (receiptBlank || startBlank || endBlank || travellingBlank) {
    return 'pending';
  }

  const matches =
    job.receiptNumberAdministrator === job.receiptNumberStenotypist &&
    job.startTimeAdministrator === job.startTimeStenotypist &&
    job.endTimeAdministrator === job.endTimeStenotypist &&
    travellingAdmin === normalizeJobTravellingChargeAmount(systemAmount);

  return matches ? 'correct' : 'errors';
}

function validateJobReconciliationSave(job, input) {
  const errors = [];
  const receiptNumberAdministrator = normalizeReceiptNumber(input.receiptNumberAdministrator);
  const startTimeAdministrator = normalizeOptionalJobTime(input.startTimeAdministrator);
  const endTimeAdministrator = normalizeOptionalJobTime(input.endTimeAdministrator);
  const travellingChargesAdministrator = normalizeJobTravellingChargeAmount(
    input.travellingChargesAdministrator,
  );
  const travellingKm = normalizeJobTravellingKm(input.travellingKm);
  const travellingKmRate = normalizeJobTravellingKmRate(input.travellingKmRate);
  const projectTravellingCharges = getProjectTravellingChargesForJob(job);

  if (!receiptNumberAdministrator) errors.push('jobReceiptNumberAdministratorRequired');
  if (!startTimeAdministrator) errors.push('jobStartTimeAdministratorRequired');
  if (!endTimeAdministrator) errors.push('jobEndTimeAdministratorRequired');
  if (input.receiptNumberAdministrator && !receiptNumberAdministrator) {
    errors.push('jobReceiptNumberAdministratorInvalid');
  }
  if (input.startTimeAdministrator && !startTimeAdministrator) {
    errors.push('jobStartTimeAdministratorInvalid');
  }
  if (input.endTimeAdministrator && !endTimeAdministrator) {
    errors.push('jobEndTimeAdministratorInvalid');
  }
  if (
    startTimeAdministrator &&
    endTimeAdministrator &&
    startTimeAdministrator >= endTimeAdministrator
  ) {
    errors.push('jobAdministratorTimeRangeInvalid');
  }

  if (projectTravellingCharges === 'billable_by_km') {
    if (!travellingKm) errors.push('jobTravellingKmRequired');
    if (!travellingKmRate) errors.push('jobTravellingKmRateRequired');
  }

  const jobForSystem = {
    ...job,
    travellingKm,
    travellingKmRate,
  };
  const travellingChargesSystem = computeSystemTravellingChargeAmountForJob(jobForSystem);

  if (
    isBillableTravellingChargesMode(projectTravellingCharges) &&
    travellingChargesAdministrator <= 0
  ) {
    errors.push('jobTravellingChargesAdministratorRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const adminFields = {
    receiptNumberAdministrator,
    startTimeAdministrator,
    endTimeAdministrator,
    travellingChargesAdministrator,
    travellingKm,
    travellingKmRate,
  };

  return {
    value: {
      ...adminFields,
      travellingChargesSystem,
      reconciliationStatus: computeReconciliationStatusForJob(
        {
          ...job,
          ...adminFields,
        },
        travellingChargesSystem,
        projectTravellingCharges,
      ),
    },
  };
}

function assertPublishedJobForAccept(job) {
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (job.status !== 'published') {
    return { errors: ['jobReconciliationNotEligible'] };
  }
  if (!job.receiptNumberStenotypist || !job.startTimeStenotypist || !job.endTimeStenotypist) {
    return { errors: ['jobReconciliationReceiptDataMissing'] };
  }
  return null;
}

function assertEditableJobForReconciliation(job) {
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (job.status !== 'published' && job.status !== 'reconciled') {
    return { errors: ['jobReconciliationNotEligible'] };
  }
  if (
    job.status === 'published' &&
    (!job.receiptNumberStenotypist || !job.startTimeStenotypist || !job.endTimeStenotypist)
  ) {
    return { errors: ['jobReconciliationReceiptDataMissing'] };
  }
  return null;
}

function assertReconciliationListJob(job) {
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (!RECONCILIATION_LIST_STATUSES.has(job.status)) {
    return { errors: ['jobReconciliationNotEligible'] };
  }
  return null;
}

function enrichJobForReconciliation(job) {
  const systemAmount = computeSystemTravellingChargeAmountForJob(job);
  const projectTravellingCharges = job.projectTravellingCharges ?? 'non_billable';
  return {
    ...job,
    travellingChargesSystem: systemAmount,
    reconciliationStatus: computeReconciliationStatusForJob(
      job,
      systemAmount,
      projectTravellingCharges,
    ),
  };
}

function filterReconciliationJobs(jobs, filters = {}) {
  const customerId = typeof filters.customerId === 'string' ? filters.customerId.trim() : '';
  const stenotypistUserId =
    typeof filters.stenotypistUserId === 'string' ? filters.stenotypistUserId.trim() : '';
  const dateFrom = normalizeJobDate(filters.dateFrom);
  const dateTo = normalizeJobDate(filters.dateTo);
  const jobStatus = normalizeJobStatus(filters.jobStatus);
  const reconciliationStatus = normalizeReconciliationStatus(filters.reconciliationStatus);

  return jobs.filter((job) => {
    if (!RECONCILIATION_LIST_STATUSES.has(job.status)) return false;
    if (customerId && job.customerId !== customerId) return false;
    if (stenotypistUserId && job.stenotypistUserId !== stenotypistUserId) return false;
    if (dateFrom && job.date < dateFrom) return false;
    if (dateTo && job.date > dateTo) return false;
    if (jobStatus && job.status !== jobStatus) return false;
    if (filters.reconciliationStatus && job.reconciliationStatus !== reconciliationStatus) {
      return false;
    }
    return true;
  });
}

function sortByReceiptNumber(jobs) {
  return [...jobs].sort((a, b) => {
    const left = a.receiptNumberStenotypist || '00000';
    const right = b.receiptNumberStenotypist || '00000';
    const comparison = left.localeCompare(right, undefined, { numeric: true });
    if (comparison !== 0) return comparison;
    return a.jobNumber.localeCompare(b.jobNumber);
  });
}

/** §2.3 — List published, reconciled, and invoiced jobs for reconciliation. */
export function listJobReconciliationRecords(actor, filters = {}) {
  const denied = assertReconciliationAccess(actor);
  if (denied) return denied;

  const jobs = sortByReceiptNumber(
    listJobRecords(null)
      .map(enrichJobForReconciliation)
      .filter((job) => filterReconciliationJobs([job], filters).length > 0),
  );

  return { jobs };
}

export function findJobReconciliationRecord(jobId, actor) {
  const denied = assertReconciliationAccess(actor);
  if (denied) return denied;

  const job = listJobRecords(null).find((row) => row.id === jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }

  const eligibility = assertReconciliationListJob(job);
  if (eligibility) return eligibility;

  return { job: enrichJobForReconciliation(job) };
}

/** §2.3 — Accept: copy stenotypist/system values and reconcile a published job. */
export function confirmJobReconciliation(jobId, actor) {
  const denied = assertReconciliationAccess(actor);
  if (denied) return denied;

  const job = findJobById(jobId);
  const publicJob = job ? toPublicJob(job) : null;
  const eligibility = assertPublishedJobForAccept(publicJob);
  if (eligibility) return eligibility;

  if (
    !canPerformJobWorkflowAction('reconcile_receipt_data', {
      status: job.status,
      userOrRoles: actor,
    })
  ) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const systemAmount = computeSystemTravellingChargeAmountForJob(job);
  const saveInput = {
    receiptNumberAdministrator: job.receiptNumberStenotypist,
    startTimeAdministrator: job.startTimeStenotypist,
    endTimeAdministrator: job.endTimeStenotypist,
    travellingChargesAdministrator: systemAmount,
    travellingKm: job.travellingKm ?? 0,
    travellingKmRate: job.travellingKmRate ?? 0,
  };

  const validation = validateJobReconciliationSave(job, saveInput);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  return updateJob(
    jobId,
    buildJobUpdatePayload(job, {
      ...validation.value,
      status: 'reconciled',
    }),
    actor,
  );
}

/** §2.2 / §2.3 — Save administrator receipt fields; reconcile published jobs. */
export function updateJobReconciliation(jobId, input, actor) {
  const denied = assertReconciliationAccess(actor);
  if (denied) return denied;

  const job = findJobById(jobId);
  const publicJob = job ? toPublicJob(job) : null;
  const eligibility = assertEditableJobForReconciliation(publicJob);
  if (eligibility) return eligibility;

  if (
    job.status === 'published' &&
    !canPerformJobWorkflowAction('reconcile_receipt_data', {
      status: job.status,
      userOrRoles: actor,
    })
  ) {
    return { errors: ['jobActionNotAllowed'] };
  }

  const validation = validateJobReconciliationSave(job, input ?? {});
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const nextStatus = job.status === 'published' ? 'reconciled' : job.status;

  return updateJob(
    jobId,
    buildJobUpdatePayload(job, {
      ...validation.value,
      status: nextStatus,
    }),
    actor,
  );
}
