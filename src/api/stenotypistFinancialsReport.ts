import { getAuthToken } from '../utils/auth';
import type {
  FetchStenotypistFinancialsReportParams,
  StenotypistFinancialsReportCandidate,
  StenotypistFinancialsReportRow,
  StenotypistFinancialsReportTotals,
} from '../types/stenotypistFinancialsReport';

async function financialsReportRequest<T>(path: string): Promise<T> {
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

function buildReportQuery(params: FetchStenotypistFinancialsReportParams): string {
  const search = new URLSearchParams();
  if (params.stenotypistUserId) search.set('stenotypistUserId', params.stenotypistUserId);
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchStenotypistFinancialsReportRecords(
  params: FetchStenotypistFinancialsReportParams = {},
): Promise<{
  rows: StenotypistFinancialsReportRow[];
  totals: StenotypistFinancialsReportTotals;
}> {
  const response = await financialsReportRequest<{
    rows: StenotypistFinancialsReportRow[];
    totals: StenotypistFinancialsReportTotals;
  }>(`/api/financials/stenotypist-financials-report${buildReportQuery(params)}`);
  return {
    rows: response.rows ?? [],
    totals: response.totals ?? { bonus: 0, penalty: 0, travelExpenses: 0, total: 0 },
  };
}

export async function fetchStenotypistFinancialsReportCandidates(): Promise<
  StenotypistFinancialsReportCandidate[]
> {
  const response = await financialsReportRequest<{
    candidates: StenotypistFinancialsReportCandidate[];
  }>('/api/financials/stenotypist-financials-report/candidates');
  return response.candidates ?? [];
}
