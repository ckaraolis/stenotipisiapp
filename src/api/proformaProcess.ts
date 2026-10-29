import { getAuthToken } from '../utils/auth';
import type {
  ProformaProcessFilters,
  ProformaProcessGroup,
  ProformaProcessItem,
  ProformaGenerationResult,
} from '../types/proformaProcess';

function buildProcessQuery(filters: ProformaProcessFilters): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.stenotypistUserId) params.set('stenotypistUserId', filters.stenotypistUserId);
  if (filters.jobStatus) params.set('jobStatus', filters.jobStatus);
  if (filters.type) params.set('type', filters.type);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function processRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchProformaProcessRecords(filters: ProformaProcessFilters = {}): Promise<{
  items: ProformaProcessItem[];
  groups: ProformaProcessGroup[];
  totalItems: number;
}> {
  return processRequest(`/api/financials/proformas/process${buildProcessQuery(filters)}`);
}

export async function generateProformasFromProcess(
  filters: ProformaProcessFilters = {},
): Promise<ProformaGenerationResult & { jobsUpdated: number; lineCount: number }> {
  return processRequest('/api/financials/proformas/process/generate', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}
