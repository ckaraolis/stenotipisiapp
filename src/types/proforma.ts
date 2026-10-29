import type { JobStatus } from './job';

export const PROFORMA_LINE_ITEM_TYPES = ['stenotyping', 'travelling'] as const;
export type ProformaLineItemType = (typeof PROFORMA_LINE_ITEM_TYPES)[number];

export interface ProformaLineItem {
  id: string;
  type: ProformaLineItemType;
  jobId: string;
  jobNumber: string;
  jobDate: string;
  jobStatus: JobStatus;
  projectLabel: string;
  stenotypistAlias: string;
  receiptNumber: string;
  jobDurationHours: number | null;
  hourlyRate: number | null;
  districtLabel: string;
  travellingCharges: number | null;
  lineTotal: number;
}

/** §3.1 — In-app billing documents are called Proformas (not invoices). Priority ERP holds true invoices. */
export const PROFORMA_DOCUMENT_TYPES = ['proforma', 'priority_invoice', 'credit_invoice'] as const;
export type ProformaDocumentType = (typeof PROFORMA_DOCUMENT_TYPES)[number];

/** §3.2 — Stored proforma status values. */
export const PROFORMA_STATUSES = ['exported', 'voided'] as const;
export type ProformaStatus = (typeof PROFORMA_STATUSES)[number];

/** Workflow state before a proforma is exported (not persisted as §3.2 status). */
export type ProformaWorkflowStatus = ProformaStatus | 'pending';

export interface ProformaRecord {
  id: string;
  /** §3.2 — Customer Reference (Priority ERP number, denormalized from customer). */
  customerReference: string;
  customerId: string;
  customerAlias?: string;
  customerName?: string;
  /** §3.4 — Alias + Name display label. */
  customerLabel?: string;
  /** §3.4 — Sum of line items on the proforma. */
  totalAmount?: number;
  /** §3.2 — PFnnnn */
  proformaNumber: string;
  /** §3.2 — ISO date (yyyy-mm-dd); display as dd/mm/yy. */
  proformaDate: string;
  /** §3.2 — Exported or Voided when set; pending until export. */
  status: ProformaWorkflowStatus;
  billingYear: number;
  billingMonth: number;
  documentType: ProformaDocumentType;
  jobIds: string[];
  jobCount?: number;
  priorityErpDocumentNumber: string;
  priorityErpPostedAt: string | null;
  priorityErpPostingKey: string;
  voidedAt: string | null;
  voidReason: string;
  replacesProformaId: string | null;
  replacedByProformaId: string | null;
  creditInvoiceProformaId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProformaCreateInput {
  customerId: string;
  billingYear: number;
  billingMonth: number;
  proformaDate?: string;
  documentType?: ProformaDocumentType;
  jobIds?: string[];
  allowAdditional?: boolean;
}

export interface ProformaVoidInput {
  voidReason?: string;
  postCreditInvoice?: boolean;
}

export interface ProformaRepostInput {
  jobIds?: string[];
  allowAdditional?: boolean;
}
