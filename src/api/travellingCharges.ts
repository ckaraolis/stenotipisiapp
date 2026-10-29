import type {
  TravellingChargeListQuery,
  TravellingChargePayload,
  TravellingChargeRecord,
} from '../types/travellingCharges';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTravellingChargeRecords(
  query: TravellingChargeListQuery = {},
): Promise<TravellingChargeRecord[]> {
  const params = new URLSearchParams();
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.districtId) params.set('districtId', query.districtId);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/financials/travelling-charges${suffix}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load travelling charge records');
  }

  const data = (await response.json()) as { charges: TravellingChargeRecord[] };
  return data.charges;
}

export async function fetchTravellingChargeById(chargeId: string): Promise<TravellingChargeRecord> {
  const response = await fetch(`/api/financials/travelling-charges/${encodeURIComponent(chargeId)}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load travelling charge record');
  }

  return response.json() as Promise<TravellingChargeRecord>;
}

export async function createTravellingCharge(
  payload: TravellingChargePayload,
): Promise<TravellingChargeRecord> {
  const response = await fetch('/api/financials/travelling-charges', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TravellingChargeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingChargeRecord;
}

export async function updateTravellingCharge(
  chargeId: string,
  payload: TravellingChargePayload,
): Promise<TravellingChargeRecord> {
  const response = await fetch(`/api/financials/travelling-charges/${encodeURIComponent(chargeId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TravellingChargeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingChargeRecord;
}

export async function deleteTravellingCharge(chargeId: string): Promise<TravellingChargeRecord> {
  const response = await fetch(`/api/financials/travelling-charges/${encodeURIComponent(chargeId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as TravellingChargeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingChargeRecord;
}
