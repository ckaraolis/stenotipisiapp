import { findCustomerById } from './customers.js';
import { isBillableTravellingChargesMode } from './jobTravellingCharges.js';
import {
  findJobById,
  listJobRecords,
  normalizeJobDate,
  normalizeJobStatus,
  normalizeJobTravellingChargeAmount,
} from './jobs.js';
import { createProformaPriorityErpExport } from './priorityErpExport.js';
import {
  createProformaRecord,
  postProformaToPriorityErp,
} from './proformas.js';
import { canAccessCustomerInvoicingModule } from './permissions.js';

const PROCESS_JOB_STATUSES = new Set(['published', 'reconciled']);

function assertProformaProcessAccess(actor) {
  if (!canAccessCustomerInvoicingModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function parseTimeToMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof time === 'string' ? time.trim() : '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function computeJobDurationHours(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return null;
  let end = endMinutes;
  if (end <= startMinutes) {
    end += 24 * 60;
  }
  return Math.round(((end - startMinutes) / 60) * 1000) / 1000;
}

function computeStenotypingLineTotal(durationHours, hourlyRate) {
  return Math.round(durationHours * hourlyRate * 100) / 100;
}

function formatProjectLabel(job) {
  const parts = [job.projectField1, job.projectField2, job.projectField3, job.projectField4].filter(
    (part) => part?.trim(),
  );
  return parts.length > 0 ? parts.join(' + ') : '—';
}

function formatDistrictLabel(job) {
  if (job.districtAlias?.trim()) return job.districtAlias.trim();
  if (job.districtName?.trim()) return job.districtName.trim();
  return '—';
}

function isTravellingDue(job) {
  if (!isBillableTravellingChargesMode(job.projectTravellingCharges)) {
    return false;
  }
  return normalizeJobTravellingChargeAmount(job.travellingChargesAdministrator) > 0;
}

function buildProcessItem(job, type, hourlyRate) {
  const receiptNumber = job.receiptNumberAdministrator || '';
  const districtLabel = formatDistrictLabel(job);

  if (type === 'travelling') {
    const travellingCharges = normalizeJobTravellingChargeAmount(job.travellingChargesAdministrator);
    return {
      id: `${job.id}:travelling`,
      type: 'travelling',
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobDate: job.date,
      jobStatus: job.status,
      customerId: job.customerId,
      customerName: job.customerName,
      projectLabel: formatProjectLabel(job),
      stenotypistAlias: job.stenotypistAlias || '—',
      receiptNumber,
      jobDurationHours: null,
      hourlyRate: null,
      districtLabel,
      travellingCharges,
      lineTotal: travellingCharges,
    };
  }

  const jobDurationHours = computeJobDurationHours(
    job.startTimeAdministrator,
    job.endTimeAdministrator,
  );
  const rate = hourlyRate ?? 0;
  const lineTotal =
    jobDurationHours !== null ? computeStenotypingLineTotal(jobDurationHours, rate) : 0;

  return {
    id: `${job.id}:stenotyping`,
    type: 'stenotyping',
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobDate: job.date,
    jobStatus: job.status,
    customerId: job.customerId,
    customerName: job.customerName,
    projectLabel: formatProjectLabel(job),
    stenotypistAlias: job.stenotypistAlias || '—',
    receiptNumber,
    jobDurationHours,
    hourlyRate: rate,
    districtLabel,
    travellingCharges: null,
    lineTotal,
  };
}

function buildItemsForJob(job, typeFilter) {
  if (!PROCESS_JOB_STATUSES.has(job.status)) return [];
  if (job.proformaNumber?.trim()) return [];

  const customer = findCustomerById(job.customerId);
  const hourlyRate = customer?.hourlyRate ?? 0;
  const items = [];

  if (!typeFilter || typeFilter === 'stenotyping') {
    items.push(buildProcessItem(job, 'stenotyping', hourlyRate));
  }

  if (isTravellingDue(job) && (!typeFilter || typeFilter === 'travelling')) {
    items.push(buildProcessItem(job, 'travelling', hourlyRate));
  }

  return items;
}

function filterProcessItems(items, filters = {}) {
  const customerId = typeof filters.customerId === 'string' ? filters.customerId.trim() : '';
  const stenotypistUserId =
    typeof filters.stenotypistUserId === 'string' ? filters.stenotypistUserId.trim() : '';
  const dateFrom = normalizeJobDate(filters.dateFrom);
  const dateTo = normalizeJobDate(filters.dateTo);
  const jobStatus = filters.jobStatus ? normalizeJobStatus(filters.jobStatus) : null;
  const typeFilter =
    filters.type === 'stenotyping' || filters.type === 'travelling' ? filters.type : '';

  return items.filter((item) => {
    if (customerId && item.customerId !== customerId) return false;
    if (stenotypistUserId) {
      const job = findJobById(item.jobId);
      if (!job || job.stenotypistUserId !== stenotypistUserId) return false;
    }
    if (dateFrom && item.jobDate < dateFrom) return false;
    if (dateTo && item.jobDate > dateTo) return false;
    if (jobStatus && item.jobStatus !== jobStatus) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    return true;
  });
}

function groupItemsByCustomer(items) {
  const groups = new Map();

  for (const item of items) {
    const key = item.customerId || item.customerName;
    if (!groups.has(key)) {
      groups.set(key, {
        customerId: item.customerId,
        customerName: item.customerName,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }

  return [...groups.values()].sort((a, b) => a.customerName.localeCompare(b.customerName));
}

function collectProcessItems(filters = {}) {
  const typeFilter =
    filters.type === 'stenotyping' || filters.type === 'travelling' ? filters.type : '';
  const jobs = listJobRecords(null);
  const items = [];

  for (const job of jobs) {
    items.push(...buildItemsForJob(job, typeFilter));
  }

  const filtered = filterProcessItems(items, filters);
  filtered.sort((a, b) => {
    const dateCompare = a.jobDate.localeCompare(b.jobDate);
    if (dateCompare !== 0) return dateCompare;
    if (a.jobNumber !== b.jobNumber) return a.jobNumber.localeCompare(b.jobNumber);
    if (a.type === b.type) return 0;
    return a.type === 'stenotyping' ? -1 : 1;
  });

  return filtered;
}

function deriveBillingPeriod(items, filters = {}) {
  const dateFrom = normalizeJobDate(filters.dateFrom);
  if (dateFrom) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateFrom);
    if (match) {
      return {
        billingYear: Number(match[1]),
        billingMonth: Number(match[2]),
      };
    }
  }

  const firstDate = items[0]?.jobDate ?? new Date().toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(firstDate);
  if (!match) {
    const now = new Date();
    return { billingYear: now.getFullYear(), billingMonth: now.getMonth() + 1 };
  }

  return {
    billingYear: Number(match[1]),
    billingMonth: Number(match[2]),
  };
}

function uniqueJobIdsFromItems(items) {
  return [...new Set(items.map((item) => item.jobId))];
}

/** §3.3 — List proforma process items grouped by customer. */
export function listProformaProcessRecords(actor, filters = {}) {
  const denied = assertProformaProcessAccess(actor);
  if (denied) return denied;

  const items = collectProcessItems(filters);
  const groups = groupItemsByCustomer(items);

  return {
    items,
    groups,
    totalItems: items.length,
  };
}

/** §3.3 — Generate proformas from the current process list. */
export function generateProformasFromProcess(actor, filters = {}) {
  const denied = assertProformaProcessAccess(actor);
  if (denied) return denied;

  const items = collectProcessItems(filters);
  if (items.length === 0) {
    return { errors: ['proformaProcessListEmpty'] };
  }

  const jobIds = uniqueJobIdsFromItems(items);
  const unreconciled = jobIds.filter((jobId) => {
    const job = listJobRecords(null).find((row) => row.id === jobId);
    return !job || job.status !== 'reconciled';
  });

  if (unreconciled.length > 0) {
    return { errors: ['proformaGenerationUnreconciledItems'] };
  }

  const groups = groupItemsByCustomer(items);
  const billingPeriod = deriveBillingPeriod(items, filters);
  const proformaDate = new Date().toISOString().slice(0, 10);
  const createdProformas = [];

  for (const group of groups) {
    const groupJobIds = uniqueJobIdsFromItems(group.items);
    const createResult = createProformaRecord(
      {
        customerId: group.customerId,
        billingYear: billingPeriod.billingYear,
        billingMonth: billingPeriod.billingMonth,
        proformaDate,
        jobIds: groupJobIds,
        allowAdditional: true,
      },
      actor,
    );

    if (createResult.errors) {
      return createResult;
    }

    const postResult = postProformaToPriorityErp(createResult.proforma.id, actor);
    if (postResult.errors) {
      return postResult;
    }

    const record = postResult.proforma;
    createdProformas.push({
      ...record,
      jobIds: groupJobIds,
    });
  }

  const exportResult = createProformaPriorityErpExport({
    proformas: createdProformas,
  });

  if (exportResult.errors) {
    return exportResult;
  }

  return {
    exportId: exportResult.exportId,
    download: exportResult.download,
    proformas: createdProformas.map((row) => ({
      id: row.id,
      proformaNumber: row.proformaNumber,
      customerId: row.customerId,
      customerName: groups.find((group) => group.customerId === row.customerId)?.customerName ?? '',
      jobIds: row.jobIds,
    })),
    jobsUpdated: jobIds.length,
    lineCount: items.length,
  };
}
