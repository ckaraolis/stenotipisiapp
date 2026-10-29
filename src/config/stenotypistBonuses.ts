import type { MonthlyBonusRecord, StenotypistBonusesCandidate } from '../types/stenotypistBonuses';

export const BONUSES_LIST_PAGE_SIZE = 20;

export function getThisYearDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

export function formatBonusStenotypistLabel(candidate: Pick<StenotypistBonusesCandidate, 'fullName' | 'username'>): string {
  if (candidate.fullName?.trim()) {
    return candidate.username?.trim()
      ? `${candidate.fullName} (${candidate.username})`
      : candidate.fullName;
  }
  return candidate.username ?? '';
}

export function formatBonusMonthLabel(year: number, month: number, locale: string): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale, { month: 'long' });
}

export function formatBonusHours(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(1);
}

export function formatBonusCurrency(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

export function formatMonthlyBonusStenotypistLabel(row: Pick<MonthlyBonusRecord, 'stenotypistFullName' | 'stenotypistUsername'>): string {
  return formatBonusStenotypistLabel({
    fullName: row.stenotypistFullName,
    username: row.stenotypistUsername,
  });
}
