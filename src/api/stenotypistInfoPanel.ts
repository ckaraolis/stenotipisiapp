import type { StenotypistInfoPanelView, StenotypistInfoPeriod } from '../types/stenotypistInfoPanel';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchStenotypistInfoPanel(
  stenotypistUserId: string,
  options: { period?: StenotypistInfoPeriod; centerDate?: string } = {},
): Promise<StenotypistInfoPanelView> {
  const params = new URLSearchParams();
  if (options.period) params.set('period', options.period);
  if (options.centerDate) params.set('centerDate', options.centerDate);

  const query = params.toString();
  const response = await fetch(
    `/api/scheduling/stenotypists/${encodeURIComponent(stenotypistUserId)}/info-panel${query ? `?${query}` : ''}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    throw new Error('Failed to load stenotypist info panel');
  }

  return response.json() as Promise<StenotypistInfoPanelView>;
}
