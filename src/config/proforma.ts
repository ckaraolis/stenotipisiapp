import type { TranslationKey } from '../i18n/translations';
import type { ProformaDocumentType, ProformaStatus, ProformaWorkflowStatus } from '../types/proforma';
import { formatDateDisplay } from '../utils/dateFormat';

/** §3.1 — Typical billing cadence; additional proformas per customer/month remain allowed. */
export const PROFORMA_TYPICAL_ONE_PER_CUSTOMER_MONTH = true;

/** §3.1 — Multi-job same-day billable travelling charges are not auto-consolidated. */
export const PROFORMA_MULTI_JOB_SAME_DAY_TRAVELLING_MANUAL = true;

/** §3.2 — Proforma number format PFnnnn. */
export const PROFORMA_NUMBER_PATTERN = /^PF\d{4}$/;

export const PROFORMA_DOCUMENT_TYPE_LABEL_KEYS: Record<ProformaDocumentType, TranslationKey> = {
  proforma: 'proformaDocumentTypeProforma',
  priority_invoice: 'proformaDocumentTypePriorityInvoice',
  credit_invoice: 'proformaDocumentTypeCreditInvoice',
};

export const PROFORMA_STATUS_LABEL_KEYS: Record<ProformaStatus, TranslationKey> = {
  exported: 'proformaStatusExported',
  voided: 'proformaStatusVoided',
};

export function proformaDocumentTypeLabelKey(type: ProformaDocumentType | string): TranslationKey {
  if ((Object.keys(PROFORMA_DOCUMENT_TYPE_LABEL_KEYS) as ProformaDocumentType[]).includes(type as ProformaDocumentType)) {
    return PROFORMA_DOCUMENT_TYPE_LABEL_KEYS[type as ProformaDocumentType];
  }
  return 'proformaDocumentTypeProforma';
}

export function proformaStatusLabelKey(status: ProformaWorkflowStatus | string): TranslationKey {
  if (status === 'pending') {
    return 'proformaStatusPending';
  }
  if ((Object.keys(PROFORMA_STATUS_LABEL_KEYS) as ProformaStatus[]).includes(status as ProformaStatus)) {
    return PROFORMA_STATUS_LABEL_KEYS[status as ProformaStatus];
  }
  return 'proformaStatusPending';
}

/** §3.2 — Display proforma date as DD/MM/YYYY. */
export function formatProformaDate(date: string): string {
  return formatDateDisplay(date);
}

export function formatProformaBillingPeriod(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function buildPriorityErpPostingKey(
  proformaId: string,
  documentType: ProformaDocumentType,
  sequence = 0,
): string {
  return `${proformaId}:${documentType}:${sequence}`;
}

export function getPreviousMonthBillingPeriod(): { billingYear: number; billingMonth: number } {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    billingYear: date.getFullYear(),
    billingMonth: date.getMonth() + 1,
  };
}

export function getTodayProformaDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** §3.4 — Default proforma list date range (last 60 days, inclusive). */
export function getLast60DaysDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const dateTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - 59);
  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    dateFrom: format(dateFrom),
    dateTo: format(dateTo),
  };
}

export function formatProformaTotalAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return '—';
  return `€${amount.toFixed(2)}`;
}

export function parseProformaError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('proformasLoadError');
    const key = code as TranslationKey;
    const translated = t(key);
    return translated === key ? t('proformasLoadError') : translated;
  } catch {
    return t('proformasLoadError');
  }
}
