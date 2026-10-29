import type { JobReconciliationStatus, JobRecord } from '../types/jobRecord';
import type { TravellingCharges } from '../types/customer';
import type { JobStatus } from '../types/job';
import type { TranslationKey } from '../i18n/translations';
import { travellingChargesLabelKey } from './customer';
import {
  formatTravellingChargeAmount,
  normalizeTravellingChargeAmountInput,
} from './travellingCharges';

export const JOB_RECONCILIATION_LIST_STATUSES: readonly JobStatus[] = [
  'published',
  'reconciled',
  'invoiced',
];

export const JOB_RECONCILIATION_STATUS_LABEL_KEYS: Record<
  JobReconciliationStatus,
  TranslationKey
> = {
  pending: 'jobReconciliationPending',
  correct: 'jobReconciliationCorrect',
  errors: 'jobReconciliationErrors',
};

export function formatJobReconciliationStatus(
  status: JobReconciliationStatus,
  t: (key: TranslationKey) => string,
): string {
  return t(JOB_RECONCILIATION_STATUS_LABEL_KEYS[status] ?? 'jobReconciliationPending');
}

export function formatJobTravellingChargeAmount(amount: number): string {
  return `€${formatTravellingChargeAmount(amount)}`;
}

export function formatJobReconciliationDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
}

export function formatJobReconciliationProjectLabel(
  job: Pick<JobRecord, 'projectField1' | 'projectField2' | 'projectField3' | 'projectField4'>,
): string {
  const parts = [
    job.projectField1,
    job.projectField2,
    job.projectField3,
    job.projectField4,
  ].filter((part) => part?.trim());
  return parts.length > 0 ? parts.join(' + ') : '—';
}

export function computeKmTravellingChargeAmount(km: string, rate: string): number {
  const kmValue = normalizeTravellingChargeAmountInput(km);
  const rateValue = normalizeTravellingChargeAmountInput(rate);
  if (kmValue === null || rateValue === null) return 0;
  return Math.round(kmValue * rateValue * 100) / 100;
}

export function resolveTravellingChargesSystemAmount(
  projectTravellingCharges: TravellingCharges,
  tableAmount: number,
  km: string,
  rate: string,
): number {
  if (projectTravellingCharges === 'non_billable') return 0;
  if (projectTravellingCharges === 'billable_by_km') {
    return computeKmTravellingChargeAmount(km, rate);
  }
  return tableAmount;
}

export function isBillableTravellingChargesMode(mode: TravellingCharges): boolean {
  return mode === 'billable_by_table' || mode === 'billable_by_km';
}

export function formatJobReconciliationTravellingCharges(
  mode: TravellingCharges,
  t: (key: TranslationKey) => string,
): string {
  return t(travellingChargesLabelKey(mode));
}

export function getPreviousMonthDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    dateFrom: format(firstDay),
    dateTo: format(lastDay),
  };
}

export function computeReconciliationStatusForJob(
  job: Pick<
    JobRecord,
    | 'receiptNumberStenotypist'
    | 'startTimeStenotypist'
    | 'endTimeStenotypist'
    | 'receiptNumberAdministrator'
    | 'startTimeAdministrator'
    | 'endTimeAdministrator'
    | 'travellingChargesAdministrator'
    | 'projectTravellingCharges'
  >,
  systemAmount: number,
): JobReconciliationStatus {
  const receiptBlank = !job.receiptNumberAdministrator;
  const startBlank = !job.startTimeAdministrator;
  const endBlank = !job.endTimeAdministrator;
  const travellingAdmin = job.travellingChargesAdministrator ?? 0;
  const travellingBlank =
    isBillableTravellingChargesMode(job.projectTravellingCharges) && travellingAdmin <= 0;

  if (receiptBlank || startBlank || endBlank || travellingBlank) {
    return 'pending';
  }

  const matches =
    job.receiptNumberAdministrator === job.receiptNumberStenotypist &&
    job.startTimeAdministrator === job.startTimeStenotypist &&
    job.endTimeAdministrator === job.endTimeStenotypist &&
    travellingAdmin === systemAmount;

  return matches ? 'correct' : 'errors';
}

export function parseJobReconciliationError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('jobReconciliationSaveError');
    const key = code as TranslationKey;
    const translated = t(key);
    return translated === key ? t('jobReconciliationSaveError') : translated;
  } catch {
    return t('jobReconciliationSaveError');
  }
}
