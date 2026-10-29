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
import { findCustomerById } from './customers.js';
import { findJobById, listJobRecords, updateJob, buildJobUpdatePayload, normalizeJobDate } from './jobs.js';
import {
  buildProformaLineItems,
  computeProformaTotalAmount,
  formatProformaCustomerLabel,
} from './proformaLineItems.js';
import { canAccessCustomerInvoicingModule } from './permissions.js';
import {
  buildPriorityErpPostingKey,
  findPriorityErpPostingByKey,
  markPriorityErpPostingVoided,
  postCreditInvoiceToPriorityErp,
  postDocumentToPriorityErp,
} from './priorityErp.js';

const PROFORMAS_PATH = path.join(DB_DIR, 'proformas.json');

const PROFORMA_NUMBER_PATTERN = /^PF\d{4}$/;
const PROFORMA_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROFORMA_DOCUMENT_TYPES = new Set(['proforma', 'priority_invoice', 'credit_invoice']);
const PROFORMA_STATUSES = new Set(['exported', 'voided']);
const ELIGIBLE_JOB_STATUSES = new Set(['reconciled', 'invoiced']);

function readProformasFile() {
  ensureCollectionFile('proformas', { proformas: [] });
  return readCollection('proformas', { proformas: [] });
}

function writeProformasFile(data) {
  writeCollection('proformas', data);
}

function generateProformaId() {
  return `pf-${crypto.randomUUID().slice(0, 8)}`;
}

function generateProformaNumber(proformas) {
  let max = 0;
  for (const row of proformas) {
    const match = /^PF(\d+)$/i.exec(row.proformaNumber ?? '');
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `PF${String(max + 1).padStart(4, '0')}`;
}

function normalizeProformaDate(value) {
  if (typeof value === 'string' && PROFORMA_DATE_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

function resolveCustomerReference(customer) {
  if (!customer) return '';
  const priorityErpNumber =
    typeof customer.priorityErpNumber === 'string' ? customer.priorityErpNumber.trim() : '';
  if (priorityErpNumber) return priorityErpNumber;
  return typeof customer.customerNumber === 'string' ? customer.customerNumber.trim() : '';
}

function normalizeStoredStatus(proforma) {
  const raw = typeof proforma.status === 'string' ? proforma.status.trim() : '';
  if (raw === 'voided' || proforma.voidedAt) return 'voided';
  if (raw === 'exported' || raw === 'posted') return 'exported';
  if (raw === 'draft' || raw === 'pending') return 'pending';
  if (proforma.priorityErpPostedAt || proforma.priorityErpDocumentNumber) return 'exported';
  return 'pending';
}

function normalizeBillingYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
}

function normalizeBillingMonth(value) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
}

function normalizeDocumentType(value) {
  const type = typeof value === 'string' ? value.trim() : 'proforma';
  return PROFORMA_DOCUMENT_TYPES.has(type) ? type : null;
}

function normalizeProformaStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  if (status === 'pending') return 'pending';
  return PROFORMA_STATUSES.has(status) ? status : null;
}

function normalizeJobIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
}

function assertProformaAccess(actor) {
  if (!canAccessCustomerInvoicingModule(actor)) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function migrateProformaRecord(proforma, allProformas) {
  const now = new Date().toISOString();
  const customer = findCustomerById(proforma.customerId);
  const legacyNumber = typeof proforma.proformaNumber === 'string' ? proforma.proformaNumber.trim() : '';
  let proformaNumber = legacyNumber;
  if (!PROFORMA_NUMBER_PATTERN.test(proformaNumber)) {
    const legacyMatch = /^PF(\d+)$/i.exec(legacyNumber);
    if (legacyMatch) {
      proformaNumber = `PF${String(Number(legacyMatch[1])).padStart(4, '0')}`;
    } else {
      proformaNumber = generateProformaNumber(allProformas.filter((row) => row.id !== proforma.id));
    }
  }

  return {
    id: proforma.id ?? generateProformaId(),
    proformaNumber,
    customerId: typeof proforma.customerId === 'string' ? proforma.customerId.trim() : '',
    customerReference:
      typeof proforma.customerReference === 'string' && proforma.customerReference.trim()
        ? proforma.customerReference.trim()
        : resolveCustomerReference(customer),
    proformaDate: normalizeProformaDate(proforma.proformaDate ?? proforma.createdAt),
    billingYear: normalizeBillingYear(proforma.billingYear) ?? new Date().getFullYear(),
    billingMonth: normalizeBillingMonth(proforma.billingMonth) ?? new Date().getMonth() + 1,
    documentType: normalizeDocumentType(proforma.documentType) ?? 'proforma',
    status: normalizeStoredStatus(proforma),
    jobIds: normalizeJobIds(proforma.jobIds),
    priorityErpDocumentNumber:
      typeof proforma.priorityErpDocumentNumber === 'string' ? proforma.priorityErpDocumentNumber.trim() : '',
    priorityErpPostedAt:
      typeof proforma.priorityErpPostedAt === 'string' ? proforma.priorityErpPostedAt : null,
    priorityErpPostingKey:
      typeof proforma.priorityErpPostingKey === 'string' ? proforma.priorityErpPostingKey.trim() : '',
    voidedAt: typeof proforma.voidedAt === 'string' ? proforma.voidedAt : null,
    voidReason: typeof proforma.voidReason === 'string' ? proforma.voidReason.trim() : '',
    replacesProformaId:
      typeof proforma.replacesProformaId === 'string' ? proforma.replacesProformaId.trim() : null,
    replacedByProformaId:
      typeof proforma.replacedByProformaId === 'string' ? proforma.replacedByProformaId.trim() : null,
    creditInvoiceProformaId:
      typeof proforma.creditInvoiceProformaId === 'string' ? proforma.creditInvoiceProformaId.trim() : null,
    createdAt: proforma.createdAt ?? now,
    updatedAt: proforma.updatedAt ?? now,
  };
}

export function ensureProformasDatabase() {
  ensureCollectionFile('proformas', { proformas: [] });
}

function findProformaRecordById(proformaId) {
  const data = readProformasFile();
  return (data.proformas ?? []).find((row) => row.id === proformaId) ?? null;
}

function saveProformaRecord(record) {
  const data = readProformasFile();
  const index = (data.proformas ?? []).findIndex((row) => row.id === record.id);
  if (index === -1) {
    data.proformas = [...(data.proformas ?? []), record];
  } else {
    data.proformas[index] = record;
  }
  writeProformasFile(data);
  return record;
}

function enrichProformaRecord(proforma) {
  const customer = findCustomerById(proforma.customerId);
  return {
    ...proforma,
    customerReference: proforma.customerReference || resolveCustomerReference(customer),
    customerAlias: customer?.alias ?? '',
    customerName: customer?.name ?? '',
    customerLabel: formatProformaCustomerLabel(customer),
    totalAmount: computeProformaTotalAmount(proforma),
    jobCount: proforma.jobIds.length,
  };
}

function findActiveProformasForCustomerMonth(customerId, billingYear, billingMonth, documentType) {
  const data = readProformasFile();
  return (data.proformas ?? []).filter(
    (row) =>
      row.customerId === customerId &&
      row.billingYear === billingYear &&
      row.billingMonth === billingMonth &&
      row.documentType === documentType &&
      row.status !== 'voided',
  );
}

function validateEligibleJobs(customerId, jobIds) {
  const errors = [];
  const jobs = [];

  for (const jobId of jobIds) {
    const job = findJobById(jobId);
    if (!job) {
      errors.push('jobNotFound');
      continue;
    }
    if (job.customerId !== customerId) {
      errors.push('proformaJobCustomerMismatch');
      continue;
    }
    if (!ELIGIBLE_JOB_STATUSES.has(job.status)) {
      errors.push('proformaJobNotEligible');
      continue;
    }
    jobs.push(job);
  }

  if (errors.length > 0) {
    return { errors: [...new Set(errors)] };
  }

  return { jobs };
}

function assignJobsToProforma(proforma, jobs, actor) {
  for (const job of jobs) {
    updateJob(
      job.id,
      buildJobUpdatePayload(job, {
        proformaNumber: proforma.proformaNumber,
        status: 'invoiced',
      }),
      actor,
    );
  }
}

function clearJobsFromProforma(proforma, actor) {
  for (const jobId of proforma.jobIds) {
    const job = findJobById(jobId);
    if (!job || job.proformaNumber !== proforma.proformaNumber) continue;
    updateJob(
      jobId,
      buildJobUpdatePayload(job, {
        proformaNumber: '',
        status: job.status === 'invoiced' ? 'reconciled' : job.status,
      }),
      actor,
    );
  }
}

/** §3.4 — List proformas with optional filters. */
export function listProformaRecords(actor, filters = {}) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const customerId = typeof filters.customerId === 'string' ? filters.customerId.trim() : '';
  const dateFrom = normalizeJobDate(filters.dateFrom);
  const dateTo = normalizeJobDate(filters.dateTo);
  const status = filters.status ? normalizeProformaStatus(filters.status) : null;

  const data = readProformasFile();
  const rows = (data.proformas ?? [])
    .filter((row) => {
      if (row.documentType === 'credit_invoice') return false;
      if (customerId && row.customerId !== customerId) return false;
      if (dateFrom && row.proformaDate < dateFrom) return false;
      if (dateTo && row.proformaDate > dateTo) return false;
      if (status && row.status !== status) return false;
      return true;
    })
    .map(enrichProformaRecord)
    .sort((a, b) => b.proformaNumber.localeCompare(a.proformaNumber));

  return { proformas: rows };
}

export function findProformaById(proformaId, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }

  return { proforma: enrichProformaRecord(proforma) };
}

/** §3.4 — Proforma with line items for View action. */
export function findProformaItems(proformaId, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }

  return {
    proforma: enrichProformaRecord(proforma),
    items: buildProformaLineItems(proforma),
  };
}

/** §3.1 — Create proforma; additional issues per customer/month are allowed. */
export function createProformaRecord(input, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const customerId = typeof input?.customerId === 'string' ? input.customerId.trim() : '';
  const billingYear = normalizeBillingYear(input?.billingYear);
  const billingMonth = normalizeBillingMonth(input?.billingMonth);
  const documentType = normalizeDocumentType(input?.documentType) ?? 'proforma';
  const jobIds = normalizeJobIds(input?.jobIds);
  const allowAdditional = input?.allowAdditional === true;
  const proformaDate = normalizeProformaDate(input?.proformaDate);
  const customer = findCustomerById(customerId);

  if (!customerId || !customer) {
    return { errors: ['proformaCustomerRequired'] };
  }
  if (!billingYear || !billingMonth) {
    return { errors: ['proformaBillingPeriodInvalid'] };
  }

  const existing = findActiveProformasForCustomerMonth(
    customerId,
    billingYear,
    billingMonth,
    documentType,
  );
  if (existing.length > 0 && !allowAdditional) {
    return { errors: ['proformaAdditionalConfirmationRequired'], existingCount: existing.length };
  }

  const jobValidation = validateEligibleJobs(customerId, jobIds);
  if (jobValidation.errors) {
    return jobValidation;
  }

  const data = readProformasFile();
  const now = new Date().toISOString();
  const proforma = migrateProformaRecord(
    {
      customerId,
      customerReference: resolveCustomerReference(customer),
      billingYear,
      billingMonth,
      proformaDate,
      documentType,
      status: 'pending',
      jobIds,
    },
    data.proformas,
  );
  proforma.createdAt = now;
  proforma.updatedAt = now;

  saveProformaRecord(proforma);
  if (jobValidation.jobs?.length) {
    assignJobsToProforma(proforma, jobValidation.jobs, actor);
  }

  return {
    proforma: enrichProformaRecord(proforma),
    warnings:
      existing.length > 0
        ? [{ code: 'proformaAdditionalIssued', existingCount: existing.length }]
        : [],
  };
}

/** §3.1 — Post proforma to Priority ERP with duplicate-prevention. */
export function postProformaToPriorityErp(proformaId, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }
  if (proforma.status === 'voided') {
    return { errors: ['proformaAlreadyVoided'] };
  }
  if (proforma.status === 'exported' && proforma.priorityErpDocumentNumber) {
    return { errors: ['priorityErpDuplicatePosting'] };
  }

  const postingKey =
    proforma.priorityErpPostingKey ||
    buildPriorityErpPostingKey(proforma.id, proforma.documentType, 0);

  const posting = postDocumentToPriorityErp({
    proformaId: proforma.id,
    postingKey,
    documentType: proforma.documentType,
    customerId: proforma.customerId,
    billingYear: proforma.billingYear,
    billingMonth: proforma.billingMonth,
    jobIds: proforma.jobIds,
  });

  if (posting.errors) {
    return posting;
  }

  const updated = {
    ...proforma,
    status: 'exported',
    priorityErpDocumentNumber: posting.priorityErpDocumentNumber,
    priorityErpPostedAt: posting.priorityErpPostedAt,
    priorityErpPostingKey: postingKey,
    updatedAt: new Date().toISOString(),
  };
  saveProformaRecord(updated);

  return { proforma: enrichProformaRecord(updated) };
}

/** §3.4 — Void exported proforma; revert jobs to Reconciled. */
export function voidProformaRecord(proformaId, input, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }
  if (proforma.status === 'voided') {
    return { errors: ['proformaAlreadyVoided'] };
  }
  if (proforma.status !== 'exported') {
    return { errors: ['proformaVoidRequiresExported'] };
  }

  const voidReason = typeof input?.voidReason === 'string' ? input.voidReason.trim() : '';
  const postCreditInvoice = input?.postCreditInvoice === true;
  const now = new Date().toISOString();

  let creditInvoiceProformaId = null;

  if (postCreditInvoice && proforma.priorityErpDocumentNumber) {
    const data = readProformasFile();
    const creditProforma = migrateProformaRecord(
      {
        customerId: proforma.customerId,
        customerReference: proforma.customerReference,
        billingYear: proforma.billingYear,
        billingMonth: proforma.billingMonth,
        proformaDate: proforma.proformaDate,
        documentType: 'credit_invoice',
        status: 'pending',
        jobIds: proforma.jobIds,
        replacesProformaId: proforma.id,
      },
      data.proformas,
    );
    creditProforma.createdAt = now;
    creditProforma.updatedAt = now;
    saveProformaRecord(creditProforma);
    creditInvoiceProformaId = creditProforma.id;

    const creditPostingKey = buildPriorityErpPostingKey(creditProforma.id, 'credit_invoice', 0);
    const creditPosting = postCreditInvoiceToPriorityErp({
      proformaId: creditProforma.id,
      postingKey: creditPostingKey,
      customerId: creditProforma.customerId,
      billingYear: creditProforma.billingYear,
      billingMonth: creditProforma.billingMonth,
      jobIds: creditProforma.jobIds,
      voidedProformaNumber: proforma.proformaNumber,
    });

    if (!creditPosting.errors) {
      saveProformaRecord({
        ...creditProforma,
        status: 'exported',
        priorityErpDocumentNumber: creditPosting.priorityErpDocumentNumber,
        priorityErpPostedAt: creditPosting.priorityErpPostedAt,
        priorityErpPostingKey: creditPostingKey,
        updatedAt: now,
      });
    }
  }

  if (proforma.priorityErpPostingKey) {
    markPriorityErpPostingVoided(proforma.priorityErpPostingKey);
  }

  clearJobsFromProforma(proforma, actor);

  const voided = {
    ...proforma,
    status: 'voided',
    voidedAt: now,
    voidReason,
    creditInvoiceProformaId,
    updatedAt: now,
  };
  saveProformaRecord(voided);

  return { proforma: enrichProformaRecord(voided) };
}

/** §3.1 — Repost after void: create a new draft proforma linked to the voided record. */
export function repostProformaRecord(proformaId, input, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }
  if (proforma.status !== 'voided') {
    return { errors: ['proformaRepostRequiresVoided'] };
  }
  if (proforma.replacedByProformaId) {
    return { errors: ['proformaAlreadyReposted'] };
  }

  const jobIds = normalizeJobIds(input?.jobIds?.length ? input.jobIds : proforma.jobIds);
  const allowAdditional = input?.allowAdditional === true;
  const jobValidation = validateEligibleJobs(proforma.customerId, jobIds);
  if (jobValidation.errors) {
    return jobValidation;
  }

  const createResult = createProformaRecord(
    {
      customerId: proforma.customerId,
      billingYear: proforma.billingYear,
      billingMonth: proforma.billingMonth,
      documentType: proforma.documentType === 'credit_invoice' ? 'proforma' : proforma.documentType,
      jobIds,
      allowAdditional,
    },
    actor,
  );

  if (createResult.errors) {
    return createResult;
  }

  const replacement = findProformaRecordById(createResult.proforma.id);
  const linked = {
    ...replacement,
    replacesProformaId: proforma.id,
    updatedAt: new Date().toISOString(),
  };
  saveProformaRecord(linked);

  saveProformaRecord({
    ...proforma,
    replacedByProformaId: linked.id,
    updatedAt: new Date().toISOString(),
  });

  return { proforma: enrichProformaRecord(linked), warnings: createResult.warnings ?? [] };
}

/** List reconciled jobs eligible for proforma assignment. */
export function listProformaEligibleJobs(actor, filters = {}) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const customerId = typeof filters.customerId === 'string' ? filters.customerId.trim() : '';
  const billingYear = filters.billingYear ? normalizeBillingYear(filters.billingYear) : null;
  const billingMonth = filters.billingMonth ? normalizeBillingMonth(filters.billingMonth) : null;

  const jobs = listJobRecords(null)
    .filter((job) => {
      if (!ELIGIBLE_JOB_STATUSES.has(job.status)) return false;
      if (customerId && job.customerId !== customerId) return false;
      if (billingYear || billingMonth) {
        const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(job.date ?? '');
        if (!match) return false;
        const jobYear = Number(match[1]);
        const jobMonth = Number(match[2]);
        if (billingYear && jobYear !== billingYear) return false;
        if (billingMonth && jobMonth !== billingMonth) return false;
      }
      if (job.proformaNumber) return false;
      return true;
    })
    .sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));

  return { jobs };
}

export function getProformaTrackingSummary(proformaId, actor) {
  const denied = assertProformaAccess(actor);
  if (denied) return denied;

  const proforma = findProformaRecordById(proformaId);
  if (!proforma) {
    return { errors: ['proformaNotFound'] };
  }

  const posting = proforma.priorityErpPostingKey
    ? findPriorityErpPostingByKey(proforma.priorityErpPostingKey)
    : null;

  return {
    proforma: enrichProformaRecord(proforma),
    priorityErpPosting: posting,
  };
}
