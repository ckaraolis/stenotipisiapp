import type { TravellingChargeRecord } from '../types/travellingCharges';

export function formatTravellingChargeAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return amount.toFixed(2);
}

/** §1.3 — Normalize amount input to 2 decimal places. */
export function normalizeTravellingChargeAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

export function formatTravellingChargeAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

export function formatTravellingChargeCustomerLabel(record: Pick<TravellingChargeRecord, 'customerName' | 'customerAlias'>): string {
  if (record.customerAlias?.trim()) {
    return `${record.customerName} (${record.customerAlias})`;
  }
  return record.customerName || '—';
}

export function formatTravellingChargeDistrictLabel(record: Pick<TravellingChargeRecord, 'districtName' | 'districtAlias'>): string {
  if (record.districtAlias?.trim()) {
    return `${record.districtName} (${record.districtAlias})`;
  }
  return record.districtName || '—';
}
