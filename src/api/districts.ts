import type { DistrictOption, DistrictPayload, DistrictRecord } from '../types/district';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchDistrictOptions(): Promise<DistrictOption[]> {
  const response = await fetch('/api/districts', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load districts');
  }

  const data = (await response.json()) as { districts: DistrictOption[] };
  return data.districts;
}

export async function fetchDistrictRecords(): Promise<DistrictRecord[]> {
  const response = await fetch('/api/districts/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load districts');
  }

  const data = (await response.json()) as { districts: DistrictRecord[] };
  return data.districts;
}

export async function fetchDistrictById(districtId: string): Promise<DistrictRecord> {
  const response = await fetch(`/api/districts/records/${districtId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load district');
  }

  return response.json() as Promise<DistrictRecord>;
}

export async function createDistrict(payload: DistrictPayload): Promise<DistrictRecord> {
  const response = await fetch('/api/districts/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as DistrictRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as DistrictRecord;
}

export async function updateDistrict(
  districtId: string,
  payload: DistrictPayload,
): Promise<DistrictRecord> {
  const response = await fetch(`/api/districts/records/${districtId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as DistrictRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as DistrictRecord;
}

export async function deleteDistrict(districtId: string): Promise<DistrictRecord> {
  const response = await fetch(`/api/districts/records/${districtId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as DistrictRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as DistrictRecord;
}
