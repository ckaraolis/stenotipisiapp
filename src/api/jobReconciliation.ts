import type { JobReconciliationStatus } from '../types/jobRecord';
import { getAuthToken } from '../utils/auth';

export interface JobReconciliationFilters {
  customerId?: string;
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  jobStatus?: string;
  reconciliationStatus?: JobReconciliationStatus | '';
}

export interface JobReconciliationPayload {
  receiptNumberAdministrator: string;
  startTimeAdministrator: string;
  endTimeAdministrator: string;
  travellingChargesAdministrator: number;
  travellingKm?: number;
  travellingKmRate?: number;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildQuery(filters: JobReconciliationFilters): string {
  const params = new URLSearchParams();
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.stenotypistUserId) params.set('stenotypistUserId', filters.stenotypistUserId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.jobStatus) params.set('jobStatus', filters.jobStatus);
  if (filters.reconciliationStatus) {
    params.set('reconciliationStatus', filters.reconciliationStatus);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchJobReconciliationRecords(filters: JobReconciliationFilters = {}) {
  const response = await fetch(`/api/financials/reconciliation${buildQuery(filters)}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job reconciliation records');
  }

  const data = (await response.json()) as { jobs: import('../types/jobRecord').JobRecord[] };
  return data.jobs;
}

export async function fetchJobReconciliationRecord(jobId: string) {
  const response = await fetch(`/api/financials/reconciliation/${jobId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job reconciliation record');
  }

  return response.json() as Promise<import('../types/jobRecord').JobRecord>;
}

export async function confirmJobReconciliation(jobId: string) {
  const response = await fetch(`/api/financials/reconciliation/${jobId}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as
    | import('../types/jobRecord').JobRecord
    | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as import('../types/jobRecord').JobRecord;
}

export async function updateJobReconciliation(
  jobId: string,
  payload: JobReconciliationPayload,
) {
  const response = await fetch(`/api/financials/reconciliation/${jobId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as
    | import('../types/jobRecord').JobRecord
    | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as import('../types/jobRecord').JobRecord;
}
