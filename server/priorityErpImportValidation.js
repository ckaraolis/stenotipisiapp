import {
  PRIORITY_ERP_EXPORT_FORMAT,
  PRIORITY_ERP_PART_CODE_STENOTYPING,
  PRIORITY_ERP_PART_CODE_TRAVELLING,
} from './priorityErpExportConfig.js';

const VALID_PART_CODES = new Set([
  PRIORITY_ERP_PART_CODE_STENOTYPING,
  PRIORITY_ERP_PART_CODE_TRAVELLING,
]);

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function pushError(errors, code, detail = '') {
  errors.push(detail ? `${code}:${detail}` : code);
}

/** §3.7 — Validate export payload structure and business rules. */
export function validatePriorityErpImportPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['priorityErpImportInvalidFormat'] };
  }

  if (payload.format && payload.format !== PRIORITY_ERP_EXPORT_FORMAT) {
    pushError(errors, 'priorityErpImportUnsupportedFormat', payload.format);
  }

  const headers = Array.isArray(payload.invoiceHeaders) ? payload.invoiceHeaders : null;
  const lines = Array.isArray(payload.invoiceLines) ? payload.invoiceLines : null;

  if (!headers || headers.length === 0) {
    pushError(errors, 'priorityErpImportMissingHeaders');
  }
  if (!lines || lines.length === 0) {
    pushError(errors, 'priorityErpImportMissingLines');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const headerByReference = new Map();

  for (const header of headers) {
    const referenceNumber =
      typeof header.referenceNumber === 'string' ? header.referenceNumber.trim() : '';
    const customerNumber =
      typeof header.customerNumber === 'string' ? header.customerNumber.trim() : '';

    if (!referenceNumber) {
      pushError(errors, 'priorityErpImportHeaderReferenceRequired');
      continue;
    }
    if (headerByReference.has(referenceNumber)) {
      pushError(errors, 'priorityErpImportDuplicateHeader', referenceNumber);
      continue;
    }
    if (!isIsoDate(header.invoiceDate)) {
      pushError(errors, 'priorityErpImportHeaderDateInvalid', referenceNumber);
    }
    if (!customerNumber) {
      pushError(errors, 'priorityErpImportCustomerNumberRequired', referenceNumber);
    }
    if (!Number.isFinite(Number(header.totalAmount))) {
      pushError(errors, 'priorityErpImportHeaderTotalInvalid', referenceNumber);
    }

    headerByReference.set(referenceNumber, {
      ...header,
      referenceNumber,
      customerNumber,
      totalAmount: roundMoney(header.totalAmount),
      lineTotal: 0,
    });
  }

  for (const line of lines) {
    const referenceNumber =
      typeof line.referenceNumber === 'string' ? line.referenceNumber.trim() : '';
    const header = headerByReference.get(referenceNumber);

    if (!header) {
      pushError(errors, 'priorityErpImportLineOrphanReference', referenceNumber || 'unknown');
      continue;
    }

    if (!isIsoDate(line.jobDate)) {
      pushError(errors, 'priorityErpImportLineJobDateInvalid', referenceNumber);
    }

    const partCode = typeof line.partCode === 'string' ? line.partCode.trim() : '';
    if (!VALID_PART_CODES.has(partCode)) {
      pushError(errors, 'priorityErpImportPartCodeInvalid', partCode || 'unknown');
    }

    if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) < 0) {
      pushError(errors, 'priorityErpImportLineQuantityInvalid', referenceNumber);
    }
    if (!Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) {
      pushError(errors, 'priorityErpImportLineUnitPriceInvalid', referenceNumber);
    }
    if (!Number.isFinite(Number(line.lineTotal)) || Number(line.lineTotal) < 0) {
      pushError(errors, 'priorityErpImportLineTotalInvalid', referenceNumber);
    }

    header.lineTotal = roundMoney(header.lineTotal + roundMoney(line.lineTotal));
  }

  for (const header of headerByReference.values()) {
    if (Math.abs(header.lineTotal - header.totalAmount) > 0.01) {
      pushError(
        errors,
        'priorityErpImportHeaderTotalMismatch',
        `${header.referenceNumber}:${header.totalAmount}:${header.lineTotal}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    headerCount: headers.length,
    lineCount: lines.length,
  };
}

/** §3.7 — Parse CSV export (RecordType H/L) back into import payload. */
export function parsePriorityErpImportCsv(content) {
  const text = typeof content === 'string' ? content.replace(/^\uFEFF/, '') : '';
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      if (current.trim()) {
        rows.push(current);
      }
      current = '';
      continue;
    }

    if (!inQuotes && char === ',') {
      current += '\u0001';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rows.push(current);
  }

  if (rows.length < 2) {
    return { errors: ['priorityErpImportInvalidFormat'] };
  }

  const splitRow = (row) => row.split('\u0001').map((cell) => cell.trim());
  const headerRow = splitRow(rows[0]);
  const columnIndex = Object.fromEntries(headerRow.map((name, index) => [name, index]));
  const invoiceHeaders = [];
  const invoiceLines = [];

  for (const row of rows.slice(1)) {
    const cells = splitRow(row);
    const recordType = cells[columnIndex.RecordType] ?? '';

    if (recordType === 'H') {
      invoiceHeaders.push({
        referenceNumber: cells[columnIndex.ReferenceNumber] ?? '',
        invoiceDate: cells[columnIndex.InvoiceDate] ?? '',
        customerNumber: cells[columnIndex.CustomerNumber] ?? '',
        totalAmount: Number(cells[columnIndex.TotalAmount] ?? 0),
      });
      continue;
    }

    if (recordType === 'L') {
      invoiceLines.push({
        referenceNumber: cells[columnIndex.ReferenceNumber] ?? '',
        jobDate: cells[columnIndex.JobDate] ?? '',
        jobReceiptNumber: cells[columnIndex.JobReceiptNumber] ?? '',
        projectField1: cells[columnIndex.ProjectField1] ?? '',
        partCode: cells[columnIndex.PartCode] ?? '',
        partDescription: cells[columnIndex.PartDescription] ?? '',
        quantity: Number(cells[columnIndex.Quantity] ?? 0),
        unitPrice: Number(cells[columnIndex.UnitPrice] ?? 0),
        vatCode: cells[columnIndex.VatCode] ?? '',
        lineTotal: Number(cells[columnIndex.LineTotal] ?? 0),
      });
    }
  }

  return {
    payload: {
      format: PRIORITY_ERP_EXPORT_FORMAT,
      invoiceHeaders,
      invoiceLines,
    },
  };
}

/** §3.7 — Priority ERP import procedure steps (implemented in Priority ERP). */
export function getPriorityErpImportProcedureSpec() {
  return {
    title: 'Import Astraea Proformas into Priority ERP',
    steps: [
      {
        order: 1,
        action: 'execute_procedure',
        description: 'Run the Astraea Proforma Import procedure from Priority ERP.',
      },
      {
        order: 2,
        action: 'select_import_file',
        description: 'Select the export file generated by Astraea via the file dialog.',
      },
      {
        order: 3,
        action: 'validate_import_file',
        description: 'Validate file structure, customer numbers, part codes, and header totals.',
        checks: [
          'priorityErpImportMissingHeaders',
          'priorityErpImportMissingLines',
          'priorityErpImportCustomerNumberRequired',
          'priorityErpImportPartCodeInvalid',
          'priorityErpImportHeaderTotalMismatch',
        ],
      },
      {
        order: 4,
        action: 'import_draft_credit_invoices',
        description: 'Import validated data as Draft Credit Invoices in Priority ERP.',
      },
      {
        order: 5,
        action: 'batch_finalise_invoices',
        description: 'Batch finalise imported invoices after review.',
      },
    ],
  };
}

export function validatePriorityErpImportFile({ content, format = 'json' }) {
  if (format === 'csv') {
    const parsed = parsePriorityErpImportCsv(content);
    if (parsed.errors) {
      return { valid: false, errors: parsed.errors };
    }
    return validatePriorityErpImportPayload(parsed.payload);
  }

  try {
    const payload = JSON.parse(content);
    return validatePriorityErpImportPayload(payload);
  } catch {
    return { valid: false, errors: ['priorityErpImportInvalidFormat'] };
  }
}
