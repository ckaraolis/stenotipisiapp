import { getAuthToken } from '../utils/auth';
import type {
  FetchJobTravelExpenseParams,
  JobTravelExpenseCandidate,
  JobTravelExpenseRecord,
} from '../types/jobTravelExpenses';

async function jobTravelExpenseRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

function buildQuery(params: FetchJobTravelExpenseParams): string {
  const search = new URLSearchParams();
  if (params.stenotypistUserId) search.set('stenotypistUserId', params.stenotypistUserId);
  if (params.status) search.set('status', params.status);
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchJobTravelExpenseRecords(
  params: FetchJobTravelExpenseParams = {},
): Promise<JobTravelExpenseRecord[]> {
  const response = await jobTravelExpenseRequest<{ expenses: JobTravelExpenseRecord[] }>(
    `/api/financials/job-travel-expenses${buildQuery(params)}`,
  );
  return response.expenses ?? [];
}

export async function fetchJobTravelExpenseCandidates(): Promise<JobTravelExpenseCandidate[]> {
  const response = await jobTravelExpenseRequest<{ candidates: JobTravelExpenseCandidate[] }>(
    '/api/financials/job-travel-expenses/candidates',
  );
  return response.candidates ?? [];
}

export async function approveJobTravelExpense(jobId: string): Promise<JobTravelExpenseRecord> {
  return jobTravelExpenseRequest<JobTravelExpenseRecord>(
    `/api/financials/job-travel-expenses/${encodeURIComponent(jobId)}/approve`,
    { method: 'POST' },
  );
}

export async function rejectJobTravelExpense(jobId: string): Promise<JobTravelExpenseRecord> {
  return jobTravelExpenseRequest<JobTravelExpenseRecord>(
    `/api/financials/job-travel-expenses/${encodeURIComponent(jobId)}/reject`,
    { method: 'POST' },
  );
}
