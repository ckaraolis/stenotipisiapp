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

const POSTINGS_PATH = path.join(DB_DIR, 'priorityErpPostings.json');

function readPostingsFile() {
  ensureCollectionFile('priorityErpPostings', { postings: [] });
  return readCollection('priorityErpPostings', { postings: [] });
}

function writePostingsFile(data) {
  writeCollection('priorityErpPostings', data);
}

export function ensurePriorityErpDatabase() {
  ensureCollectionFile('priorityErpPostings', { postings: [] });
}

export function buildPriorityErpPostingKey(proformaId, documentType, sequence = 0) {
  return `${proformaId}:${documentType}:${sequence}`;
}

export function findPriorityErpPostingByKey(postingKey) {
  const data = readPostingsFile();
  return (data.postings ?? []).find((row) => row.postingKey === postingKey) ?? null;
}

export function listPriorityErpPostingsForProforma(proformaId) {
  const data = readPostingsFile();
  return (data.postings ?? []).filter((row) => row.proformaId === proformaId);
}

function recordPriorityErpPosting(entry) {
  const data = readPostingsFile();
  data.postings = [...(data.postings ?? []), entry];
  writePostingsFile(data);
  return entry;
}

function generateStubPriorityErpNumber(documentType) {
  const prefix =
    documentType === 'credit_invoice' ? 'CR' : documentType === 'priority_invoice' ? 'INV' : 'PF';
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * §3.1 — Post a billing document to Priority ERP with duplicate-prevention tracking.
 * Real ERP integration can replace the stub response generator later.
 */
export function postDocumentToPriorityErp({
  proformaId,
  postingKey,
  documentType,
  customerId,
  billingYear,
  billingMonth,
  jobIds = [],
}) {
  if (!postingKey) {
    return { errors: ['priorityErpPostingKeyRequired'] };
  }

  const existing = findPriorityErpPostingByKey(postingKey);
  if (existing && existing.status !== 'voided') {
    return { errors: ['priorityErpDuplicatePosting'] };
  }

  const priorityErpDocumentNumber = generateStubPriorityErpNumber(documentType);
  const postedAt = new Date().toISOString();

  const posting = recordPriorityErpPosting({
    id: `erp-${crypto.randomUUID().slice(0, 8)}`,
    proformaId,
    postingKey,
    documentType,
    customerId,
    billingYear,
    billingMonth,
    jobIds,
    priorityErpDocumentNumber,
    postedAt,
    status: 'posted',
  });

  return {
    priorityErpDocumentNumber,
    priorityErpPostedAt: postedAt,
    posting,
  };
}

/** §3.1 — Automation for credit invoices when voiding a posted proforma/invoice. */
export function postCreditInvoiceToPriorityErp({
  proformaId,
  postingKey,
  customerId,
  billingYear,
  billingMonth,
  jobIds = [],
  voidedProformaNumber = '',
}) {
  return postDocumentToPriorityErp({
    proformaId,
    postingKey,
    documentType: 'credit_invoice',
    customerId,
    billingYear,
    billingMonth,
    jobIds,
    voidedProformaNumber,
  });
}

export function markPriorityErpPostingVoided(postingKey) {
  const data = readPostingsFile();
  let changed = false;
  data.postings = (data.postings ?? []).map((row) => {
    if (row.postingKey !== postingKey) return row;
    changed = true;
    return {
      ...row,
      status: 'voided',
      voidedAt: new Date().toISOString(),
    };
  });
  if (changed) {
    writePostingsFile(data);
  }
}
