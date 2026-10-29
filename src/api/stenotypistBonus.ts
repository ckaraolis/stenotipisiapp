import { getAuthToken } from '../utils/auth';
import type {
  StenotypistBonusCandidate,
  StenotypistBonusConfigurationFilters,
  StenotypistBonusConfigurationPayload,
  StenotypistBonusConfigurationRecord,
} from '../types/stenotypistBonus';

async function bonusRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

function buildBonusQuery(filters: StenotypistBonusConfigurationFilters): string {
  const params = new URLSearchParams();
  if (filters.stenotypistUserId) params.set('stenotypistUserId', filters.stenotypistUserId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchBonusConfigurationRecords(
  filters: StenotypistBonusConfigurationFilters = {},
): Promise<StenotypistBonusConfigurationRecord[]> {
  const data = await bonusRequest<{ configurations: StenotypistBonusConfigurationRecord[] }>(
    `/api/financials/stenotypist-bonus${buildBonusQuery(filters)}`,
  );
  return data.configurations;
}

export async function fetchBonusConfigurationById(
  configurationId: string,
): Promise<StenotypistBonusConfigurationRecord> {
  return bonusRequest(`/api/financials/stenotypist-bonus/${configurationId}`);
}

export async function fetchBonusStenotypistCandidates(): Promise<StenotypistBonusCandidate[]> {
  const data = await bonusRequest<{ candidates: StenotypistBonusCandidate[] }>(
    '/api/financials/stenotypist-bonus/candidates',
  );
  return data.candidates;
}

export async function createBonusConfiguration(
  input: StenotypistBonusConfigurationPayload,
): Promise<StenotypistBonusConfigurationRecord> {
  return bonusRequest<StenotypistBonusConfigurationRecord>('/api/financials/stenotypist-bonus', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBonusConfiguration(
  configurationId: string,
  input: StenotypistBonusConfigurationPayload,
): Promise<StenotypistBonusConfigurationRecord> {
  return bonusRequest<StenotypistBonusConfigurationRecord>(
    `/api/financials/stenotypist-bonus/${configurationId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteBonusConfiguration(
  configurationId: string,
): Promise<StenotypistBonusConfigurationRecord> {
  return bonusRequest<StenotypistBonusConfigurationRecord>(
    `/api/financials/stenotypist-bonus/${configurationId}`,
    {
      method: 'DELETE',
    },
  );
}
