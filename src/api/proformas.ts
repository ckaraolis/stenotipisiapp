import { getAuthToken } from '../utils/auth';
import type {
  ProformaCreateInput,
  ProformaLineItem,
  ProformaRecord,
  ProformaRepostInput,
  ProformaVoidInput,
} from '../types/proforma';
import type { JobRecord } from '../types/jobRecord';

export interface ProformaFilters {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  billingYear?: number | string;
  billingMonth?: number | string;
  status?: string;
  documentType?: string;
}

async function proformasRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildProformaQuery(filters: ProformaFilters): string {
  const params = new URLSearchParams();
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.billingYear) params.set('billingYear', String(filters.billingYear));
  if (filters.billingMonth) params.set('billingMonth', String(filters.billingMonth));
  if (filters.status) params.set('status', filters.status);
  if (filters.documentType) params.set('documentType', filters.documentType);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchProformaRecords(filters: ProformaFilters = {}): Promise<ProformaRecord[]> {
  const data = await proformasRequest<{ proformas: ProformaRecord[] }>(
    `/api/financials/proformas${buildProformaQuery(filters)}`,
  );
  return data.proformas;
}

export async function fetchProformaItems(
  proformaId: string,
): Promise<{ proforma: ProformaRecord; items: ProformaLineItem[] }> {
  return proformasRequest(`/api/financials/proformas/${proformaId}/items`);
}

export async function fetchProformaEligibleJobs(
  filters: ProformaFilters = {},
): Promise<JobRecord[]> {
  const data = await proformasRequest<{ jobs: JobRecord[] }>(
    `/api/financials/proformas/eligible-jobs${buildProformaQuery(filters)}`,
  );
  return data.jobs;
}

export async function createProforma(
  input: ProformaCreateInput,
): Promise<{ proforma: ProformaRecord; warnings?: { code: string; existingCount?: number }[] }> {
  return proformasRequest('/api/financials/proformas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function postProformaToPriorityErp(proformaId: string): Promise<ProformaRecord> {
  return proformasRequest(`/api/financials/proformas/${proformaId}/post`, {
    method: 'POST',
  });
}

export async function voidProforma(
  proformaId: string,
  input: ProformaVoidInput = {},
): Promise<ProformaRecord> {
  return proformasRequest(`/api/financials/proformas/${proformaId}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function repostProforma(
  proformaId: string,
  input: ProformaRepostInput = {},
): Promise<{ proforma: ProformaRecord; warnings?: { code: string; existingCount?: number }[] }> {
  return proformasRequest(`/api/financials/proformas/${proformaId}/repost`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
