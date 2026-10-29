import { listJobRecords } from './jobs.js';
import { buildProformaLineItems, computeProformaTotalAmount } from './proformaLineItems.js';
import {
  PRIORITY_ERP_EXPORT_FORMAT,
  PRIORITY_ERP_PART_CODE_STENOTYPING,
  PRIORITY_ERP_PART_CODE_TRAVELLING,
  PRIORITY_ERP_PART_DESCRIPTIONS,
  PRIORITY_ERP_VAT_CODE_DEFAULT,
} from './priorityErpExportConfig.js';

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function findJobById(jobId) {
  return listJobRecords(null).find((row) => row.id === jobId) ?? null;
}

function resolveProjectField1(job) {
  if (!job) return '';
  return typeof job.projectField1 === 'string' ? job.projectField1.trim() : '';
}

function buildErpInvoiceLine(proforma, lineItem) {
  const job = findJobById(lineItem.jobId);
  const isTravelling = lineItem.type === 'travelling';
  const partCode = isTravelling
    ? PRIORITY_ERP_PART_CODE_TRAVELLING
    : PRIORITY_ERP_PART_CODE_STENOTYPING;
  const partDescription = isTravelling
    ? PRIORITY_ERP_PART_DESCRIPTIONS.travelling
    : PRIORITY_ERP_PART_DESCRIPTIONS.stenotyping;
  const quantity = isTravelling ? 1 : roundMoney(lineItem.jobDurationHours ?? 0);
  const unitPrice = isTravelling
    ? roundMoney(lineItem.lineTotal)
    : roundMoney(lineItem.hourlyRate ?? 0);
  const lineTotal = roundMoney(lineItem.lineTotal);

  return {
    referenceNumber: proforma.proformaNumber,
    jobDate: lineItem.jobDate,
    jobReceiptNumber: lineItem.receiptNumber || '',
    projectField1: resolveProjectField1(job),
    partCode,
    partDescription,
    quantity,
    unitPrice,
    vatCode: PRIORITY_ERP_VAT_CODE_DEFAULT,
    lineTotal,
    lineType: lineItem.type,
    jobId: lineItem.jobId,
    jobNumber: lineItem.jobNumber,
  };
}

function sortInvoiceLines(lines) {
  return [...lines].sort((a, b) => {
    const dateCompare = a.jobDate.localeCompare(b.jobDate);
    if (dateCompare !== 0) return dateCompare;
    if (a.referenceNumber !== b.referenceNumber) {
      return a.referenceNumber.localeCompare(b.referenceNumber);
    }
    if (a.jobNumber !== b.jobNumber) return a.jobNumber.localeCompare(b.jobNumber);
    return a.lineType === 'stenotyping' ? -1 : 1;
  });
}

/** §3.6 — Build invoice headers and lines for Priority ERP import. */
export function buildPriorityErpInvoiceExport(proformas = []) {
  const invoiceHeaders = [];
  const invoiceLines = [];

  for (const proforma of proformas) {
    const lines = buildProformaLineItems(proforma).map((lineItem) =>
      buildErpInvoiceLine(proforma, lineItem),
    );
    const totalAmount = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const computedTotal = computeProformaTotalAmount(proforma);

    invoiceHeaders.push({
      referenceNumber: proforma.proformaNumber,
      invoiceDate: proforma.proformaDate,
      customerNumber: proforma.customerReference || '',
      totalAmount: totalAmount || computedTotal,
      proformaId: proforma.id,
      customerId: proforma.customerId,
    });
    invoiceLines.push(...lines);
  }

  return {
    format: PRIORITY_ERP_EXPORT_FORMAT,
    invoiceHeaders,
    invoiceLines: sortInvoiceLines(invoiceLines),
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values) {
  return values.map(csvEscape).join(',');
}

/** §3.6 — Serialize export as a single CSV file (H = header, L = line). */
export function serializePriorityErpExportCsv(exportPayload) {
  const headerColumns = [
    'RecordType',
    'ReferenceNumber',
    'InvoiceDate',
    'CustomerNumber',
    'TotalAmount',
    'JobDate',
    'JobReceiptNumber',
    'ProjectField1',
    'PartCode',
    'PartDescription',
    'Quantity',
    'UnitPrice',
    'VatCode',
    'LineTotal',
  ];

  const rows = [csvRow(headerColumns)];

  for (const header of exportPayload.invoiceHeaders ?? []) {
    rows.push(
      csvRow([
        'H',
        header.referenceNumber,
        header.invoiceDate,
        header.customerNumber,
        header.totalAmount.toFixed(2),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    );
  }

  for (const line of exportPayload.invoiceLines ?? []) {
    rows.push(
      csvRow([
        'L',
        line.referenceNumber,
        '',
        '',
        '',
        line.jobDate,
        line.jobReceiptNumber,
        line.projectField1,
        line.partCode,
        line.partDescription,
        line.quantity,
        line.unitPrice.toFixed(2),
        line.vatCode,
        line.lineTotal.toFixed(2),
      ]),
    );
  }

  return `${rows.join('\r\n')}\r\n`;
}

export function serializePriorityErpExportJson(exportPayload, meta = {}) {
  return JSON.stringify(
    {
      ...exportPayload,
      ...meta,
    },
    null,
    2,
  );
}
