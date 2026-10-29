import type { StenotypistSummaryReportView } from '../types/stenotypistSummaryReport';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchStenotypistSummaryReport(
  centerDate: string,
): Promise<StenotypistSummaryReportView> {
  const params = new URLSearchParams({ centerDate });
  const response = await fetch(`/api/scheduling/reports/stenotypist-summary?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist summary report');
  }

  return response.json() as Promise<StenotypistSummaryReportView>;
}
