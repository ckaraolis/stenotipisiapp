import { getAuthToken } from '../utils/auth';
import type {
  FetchJobPenaltyRecordsParams,
  JobPenaltyRecord,
  StenotypistPenaltiesCandidate,
} from '../types/stenotypistPenalties';

async function penaltiesRequest<T>(path: string): Promise<T> {
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

function buildPenaltiesQuery(params: FetchJobPenaltyRecordsParams): string {
  const search = new URLSearchParams();
  if (params.stenotypistUserId) search.set('stenotypistUserId', params.stenotypistUserId);
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchJobPenaltyRecords(
  params: FetchJobPenaltyRecordsParams = {},
): Promise<JobPenaltyRecord[]> {
  const response = await penaltiesRequest<{ penalties: JobPenaltyRecord[] }>(
    `/api/financials/stenotypist-penalties${buildPenaltiesQuery(params)}`,
  );
  return response.penalties ?? [];
}

export async function fetchPenaltiesStenotypistCandidates(): Promise<StenotypistPenaltiesCandidate[]> {
  const response = await penaltiesRequest<{ candidates: StenotypistPenaltiesCandidate[] }>(
    '/api/financials/stenotypist-penalties/candidates',
  );
  return response.candidates ?? [];
}
