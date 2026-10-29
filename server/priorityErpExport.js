import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  DB_DIR,
} from './collectionStore.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { PRIORITY_ERP_EXPORT_FORMAT } from './priorityErpExportConfig.js';
import {
  buildPriorityErpInvoiceExport,
  serializePriorityErpExportCsv,
  serializePriorityErpExportJson,
} from './priorityErpExportFormat.js';
import { validatePriorityErpImportPayload } from './priorityErpImportValidation.js';

function readExportsFile() {
  ensureCollectionFile('priorityErpExports', { exports: [] });
  return readCollection('priorityErpExports', { exports: [] });
}

function writeExportsFile(data) {
  writeCollection('priorityErpExports', data);
}

export function ensurePriorityErpExportsDatabase() {
  ensureCollectionFile('priorityErpExports', { exports: [] });
}

function buildExportFiles(exportId, payload) {
  const jsonContent = serializePriorityErpExportJson(payload, {
    exportId,
    createdAt: payload.createdAt,
  });
  const csvContent = serializePriorityErpExportCsv(payload);
  return { jsonContent, csvContent };
}

export function findPriorityErpExportById(exportId) {
  const data = readExportsFile();
  return (data.exports ?? []).find((row) => row.id === exportId) ?? null;
}

/**
 * §3.6 — Create one Priority ERP import file (JSON + CSV) for generated proformas.
 */
export function createProformaPriorityErpExport({ proformas = [] }) {
  const exportId = `erp-export-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const payload = buildPriorityErpInvoiceExport(proformas);
  const validation = validatePriorityErpImportPayload(payload);

  if (!validation.valid) {
    return { errors: validation.errors };
  }

  const files = buildExportFiles(exportId, { ...payload, createdAt });

  const entry = {
    id: exportId,
    createdAt,
    format: PRIORITY_ERP_EXPORT_FORMAT,
    proformaIds: proformas.map((row) => row.id),
    proformaNumbers: proformas.map((row) => row.proformaNumber),
    headerCount: payload.invoiceHeaders.length,
    lineCount: payload.invoiceLines.length,
    invoiceHeaders: payload.invoiceHeaders,
    invoiceLines: payload.invoiceLines,
    jsonContent: files.jsonContent,
    csvContent: files.csvContent,
  };

  const data = readExportsFile();
  data.exports = [...(data.exports ?? []), entry];
  writeExportsFile(data);

  return {
    exportId,
    export: entry,
    files: {
      jsonPath: `memory://${exportId}.json`,
      csvPath: `memory://${exportId}.csv`,
    },
    download: {
      json: `/api/financials/priority-erp/exports/${exportId}/download?format=json`,
      csv: `/api/financials/priority-erp/exports/${exportId}/download?format=csv`,
    },
  };
}

export function getPriorityErpExportDownloadContent(exportId, format = 'csv') {
  const record = findPriorityErpExportById(exportId);
  if (!record) return null;
  if (format === 'json') {
    if (record.jsonContent) return record.jsonContent;
    return serializePriorityErpExportJson(
      {
        invoiceHeaders: record.invoiceHeaders ?? [],
        invoiceLines: record.invoiceLines ?? [],
        createdAt: record.createdAt,
      },
      { exportId, createdAt: record.createdAt },
    );
  }
  if (record.csvContent) return record.csvContent;
  return serializePriorityErpExportCsv({
    invoiceHeaders: record.invoiceHeaders ?? [],
    invoiceLines: record.invoiceLines ?? [],
  });
}

/** @deprecated Prefer getPriorityErpExportDownloadContent for serverless. */
export function getPriorityErpExportDownloadPath(exportId, format = 'csv') {
  const content = getPriorityErpExportDownloadContent(exportId, format);
  if (!content) return null;
  return path.join(DB_DIR, 'exports', 'priority-erp', `${exportId}.${format === 'json' ? 'json' : 'csv'}`);
}

export function getPriorityErpExportDownloadFilename(exportId, format = 'csv') {
  const normalized = format === 'json' ? 'json' : 'csv';
  return `astraea-priority-erp-${exportId}.${normalized}`;
}
