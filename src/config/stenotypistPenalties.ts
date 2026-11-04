import type { JobPenaltyRecord, StenotypistPenaltiesCandidate } from '../types/stenotypistPenalties';
import { formatDateDisplay, formatDateTimeDisplay as formatDateTimeDisplayShared } from '../utils/dateFormat';

export const PENALTIES_LIST_PAGE_SIZE = 20;

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

export function formatPenaltyStenotypistLabel(
  candidate: Pick<StenotypistPenaltiesCandidate, 'fullName' | 'username'>,
): string {
  if (candidate.fullName?.trim()) {
    return candidate.username?.trim()
      ? `${candidate.fullName} (${candidate.username})`
      : candidate.fullName;
  }
  return candidate.username ?? '';
}

export function formatJobPenaltyStenotypistLabel(
  row: Pick<JobPenaltyRecord, 'stenotypistFullName' | 'stenotypistUsername'>,
): string {
  return formatPenaltyStenotypistLabel({
    fullName: row.stenotypistFullName,
    username: row.stenotypistUsername,
  });
}

export function formatJobDateDdMmYy(isoDate: string): string {
  return formatDateDisplay(isoDate);
}

export function formatDateTimeDisplay(isoDateTime: string): string {
  return formatDateTimeDisplayShared(isoDateTime);
}

export function formatPenaltyDelayHours(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return `${value.toFixed(1)} h`;
}

export function formatPenaltyListCurrency(value: number): string {
  if (!Number.isFinite(value)) return '€0.00';
  return `€${value.toFixed(2)}`;
}
