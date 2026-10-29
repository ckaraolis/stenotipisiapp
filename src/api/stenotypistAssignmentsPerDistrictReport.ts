import type { StenotypistAssignmentsPerDistrictReportView } from '../types/stenotypistAssignmentsPerDistrictReport';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface FetchAssignmentsPerDistrictParams {
  dateFrom: string;
  dateTo: string;
  page?: number;
  pageSize?: number;
  sortDirection?: 'asc' | 'desc';
}

export async function fetchStenotypistAssignmentsPerDistrictReport(
  params: FetchAssignmentsPerDistrictParams,
): Promise<StenotypistAssignmentsPerDistrictReportView> {
  const search = new URLSearchParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 50),
    sortDirection: params.sortDirection ?? 'asc',
  });

  const response = await fetch(
    `/api/scheduling/reports/stenotypist-assignments-per-district?${search.toString()}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { errors?: string[] } | null;
    if (data?.errors?.length) {
      throw new Error(JSON.stringify({ errors: data.errors }));
    }
    throw new Error('Failed to load stenotypist assignments per district report');
  }

  return response.json() as Promise<StenotypistAssignmentsPerDistrictReportView>;
}
