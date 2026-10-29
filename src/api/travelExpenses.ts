import { getAuthToken } from '../utils/auth';
import type {
  TravelExpenseCandidate,
  TravelExpenseConfigurationFilters,
  TravelExpenseConfigurationPayload,
  TravelExpenseConfigurationRecord,
} from '../types/travelExpenses';

async function travelExpenseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return response.json() as Promise<T>;
}

function buildTravelExpenseQuery(filters: TravelExpenseConfigurationFilters): string {
  const params = new URLSearchParams();
  if (filters.stenotypistUserId) params.set('stenotypistUserId', filters.stenotypistUserId);
  if (filters.districtId) params.set('districtId', filters.districtId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchTravelExpenseRecords(
  filters: TravelExpenseConfigurationFilters = {},
): Promise<TravelExpenseConfigurationRecord[]> {
  const data = await travelExpenseRequest<{ configurations: TravelExpenseConfigurationRecord[] }>(
    `/api/financials/travel-expenses${buildTravelExpenseQuery(filters)}`,
  );
  return data.configurations;
}

export async function fetchTravelExpenseById(
  configurationId: string,
): Promise<TravelExpenseConfigurationRecord> {
  return travelExpenseRequest(`/api/financials/travel-expenses/${configurationId}`);
}

export async function fetchTravelExpenseStenotypistCandidates(): Promise<TravelExpenseCandidate[]> {
  const data = await travelExpenseRequest<{ candidates: TravelExpenseCandidate[] }>(
    '/api/financials/travel-expenses/candidates',
  );
  return data.candidates;
}

export async function createTravelExpense(
  payload: TravelExpenseConfigurationPayload,
): Promise<TravelExpenseConfigurationRecord> {
  return travelExpenseRequest<TravelExpenseConfigurationRecord>('/api/financials/travel-expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTravelExpense(
  configurationId: string,
  payload: TravelExpenseConfigurationPayload,
): Promise<TravelExpenseConfigurationRecord> {
  return travelExpenseRequest<TravelExpenseConfigurationRecord>(
    `/api/financials/travel-expenses/${configurationId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteTravelExpense(
  configurationId: string,
): Promise<TravelExpenseConfigurationRecord> {
  return travelExpenseRequest<TravelExpenseConfigurationRecord>(
    `/api/financials/travel-expenses/${configurationId}`,
    {
      method: 'DELETE',
    },
  );
}
