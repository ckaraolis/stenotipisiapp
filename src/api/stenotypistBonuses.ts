import { getAuthToken } from '../utils/auth';
import type { MonthlyBonusRecord, StenotypistBonusesCandidate } from '../types/stenotypistBonuses';
import type { FetchMonthlyBonusRecordsParams } from '../types/stenotypistBonuses';

async function bonusesRequest<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return response.json() as Promise<T>;
}

function buildBonusesQuery(params: FetchMonthlyBonusRecordsParams): string {
  const search = new URLSearchParams();
  if (params.stenotypistUserId) search.set('stenotypistUserId', params.stenotypistUserId);
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchMonthlyBonusRecords(
  params: FetchMonthlyBonusRecordsParams = {},
): Promise<MonthlyBonusRecord[]> {
  const response = await bonusesRequest<{ bonuses: MonthlyBonusRecord[] }>(
    `/api/financials/stenotypist-bonuses${buildBonusesQuery(params)}`,
  );
  return response.bonuses ?? [];
}

export async function fetchBonusesStenotypistCandidates(): Promise<StenotypistBonusesCandidate[]> {
  const response = await bonusesRequest<{ candidates: StenotypistBonusesCandidate[] }>(
    '/api/financials/stenotypist-bonuses/candidates',
  );
  return response.candidates ?? [];
}
