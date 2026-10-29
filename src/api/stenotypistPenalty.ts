import { getAuthToken } from '../utils/auth';
import type {
  StenotypistPenaltyConfigurationFilters,
  StenotypistPenaltyConfigurationPayload,
  StenotypistPenaltyConfigurationRecord,
} from '../types/stenotypistPenalty';

async function penaltyRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

function buildPenaltyQuery(filters: StenotypistPenaltyConfigurationFilters): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchPenaltyConfigurationRecords(
  filters: StenotypistPenaltyConfigurationFilters = {},
): Promise<StenotypistPenaltyConfigurationRecord[]> {
  const data = await penaltyRequest<{ configurations: StenotypistPenaltyConfigurationRecord[] }>(
    `/api/financials/stenotypist-penalty${buildPenaltyQuery(filters)}`,
  );
  return data.configurations;
}

export async function fetchPenaltyConfigurationById(
  configurationId: string,
): Promise<StenotypistPenaltyConfigurationRecord> {
  return penaltyRequest(`/api/financials/stenotypist-penalty/${configurationId}`);
}

export async function createPenaltyConfiguration(
  payload: StenotypistPenaltyConfigurationPayload,
): Promise<StenotypistPenaltyConfigurationRecord> {
  return penaltyRequest<StenotypistPenaltyConfigurationRecord>('/api/financials/stenotypist-penalty', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePenaltyConfiguration(
  configurationId: string,
  payload: StenotypistPenaltyConfigurationPayload,
): Promise<StenotypistPenaltyConfigurationRecord> {
  return penaltyRequest<StenotypistPenaltyConfigurationRecord>(
    `/api/financials/stenotypist-penalty/${configurationId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function deletePenaltyConfiguration(
  configurationId: string,
): Promise<StenotypistPenaltyConfigurationRecord> {
  return penaltyRequest<StenotypistPenaltyConfigurationRecord>(
    `/api/financials/stenotypist-penalty/${configurationId}`,
    {
      method: 'DELETE',
    },
  );
}
