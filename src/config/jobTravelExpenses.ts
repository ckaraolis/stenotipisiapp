import type { TranslationKey } from '../i18n/translations';
import type { JobTravelExpenseCandidate, TravelExpenseStatus } from '../types/jobTravelExpenses';
import { formatDateDisplay } from '../utils/dateFormat';

export const JOB_TRAVEL_EXPENSES_PAGE_SIZE = 20;

export const TRAVEL_EXPENSE_STATUS_OPTIONS: readonly TravelExpenseStatus[] = [
  'pending',
  'approved',
  'rejected',
];

export function getPreviousMonthDateRange(): { from: string; to: string } {
  const today = new Date();
  const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const monthIndex = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
  const month = String(monthIndex + 1).padStart(2, '0');
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatJobTravelExpenseStenotypistLabel(
  candidate: Pick<JobTravelExpenseCandidate, 'fullName' | 'username'>,
): string {
  if (candidate.fullName?.trim()) {
    return candidate.username?.trim()
      ? `${candidate.fullName} (${candidate.username})`
      : candidate.fullName;
  }
  return candidate.username ?? '';
}

export function formatProjectDistrictLabel(name: string, alias: string): string {
  if (name && alias) return `${name} (${alias})`;
  return name || alias || '—';
}

export function formatJobDateDdMmYy(isoDate: string): string {
  return formatDateDisplay(isoDate);
}

export function formatTravelExpenseListAmount(value: number): string {
  if (!Number.isFinite(value)) return '€0.00';
  return `€${value.toFixed(2)}`;
}

export function travelExpenseStatusLabelKey(status: TravelExpenseStatus | string): TranslationKey {
  if (status === 'approved') return 'travelExpenseStatusApproved';
  if (status === 'rejected') return 'travelExpenseStatusRejected';
  return 'travelExpenseStatusPending';
}

export function parseJobTravelExpenseActionError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('jobTravelExpenseActionError');
    const key = code as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      return t('jobTravelExpenseActionError');
    }
    return translated;
  } catch {
    return t('jobTravelExpenseActionError');
  }
}
