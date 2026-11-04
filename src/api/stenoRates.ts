import type {
  StenoRateImportResult,
  StenoRateImportRow,
  StenoRateListQuery,
  StenoRatePayload,
  StenoRateRecord,
} from '../types/stenoRates';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchStenoRateRecords(
  query: StenoRateListQuery = {},
): Promise<StenoRateRecord[]> {
  const params = new URLSearchParams();
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.search) params.set('search', query.search);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/financials/steno-rates${suffix}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load steno rate records');
  }

  const data = (await response.json()) as { rates: StenoRateRecord[] };
  return data.rates;
}

export async function fetchStenoRateById(rateId: string): Promise<StenoRateRecord> {
  const response = await fetch(`/api/financials/steno-rates/${encodeURIComponent(rateId)}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load steno rate record');
  }

  return response.json() as Promise<StenoRateRecord>;
}

export async function createStenoRate(payload: StenoRatePayload): Promise<StenoRateRecord> {
  const response = await fetch('/api/financials/steno-rates', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenoRateRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenoRateRecord;
}

export async function updateStenoRate(
  rateId: string,
  payload: StenoRatePayload,
): Promise<StenoRateRecord> {
  const response = await fetch(`/api/financials/steno-rates/${encodeURIComponent(rateId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenoRateRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenoRateRecord;
}

export async function deleteStenoRate(rateId: string): Promise<StenoRateRecord> {
  const response = await fetch(`/api/financials/steno-rates/${encodeURIComponent(rateId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as StenoRateRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenoRateRecord;
}

export async function importStenoRateRows(
  rows: StenoRateImportRow[],
): Promise<StenoRateImportResult> {
  const response = await fetch('/api/financials/steno-rates/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rows }),
  });

  const data = (await response.json()) as StenoRateImportResult | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenoRateImportResult;
}
