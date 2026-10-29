import type { JobPenaltyRecord, StenotypistPenaltiesCandidate } from '../types/stenotypistPenalties';

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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate?.trim() ?? '');
  if (!match) return isoDate || '—';
  return `${match[3]}/${match[2]}/${match[1].slice(2)}`;
}

export function formatDateTimeDisplay(isoDateTime: string): string {
  if (!isoDateTime) return '—';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatPenaltyDelayHours(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return `${value.toFixed(1)} h`;
}

export function formatPenaltyListCurrency(value: number): string {
  if (!Number.isFinite(value)) return '€0.00';
  return `€${value.toFixed(2)}`;
}
