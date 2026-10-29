import type { PublicHolidayPayload, PublicHolidayRecord } from '../types/publicHoliday';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPublicHolidayRecords(): Promise<PublicHolidayRecord[]> {
  const response = await fetch('/api/scheduling/public-holidays/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load public holidays');
  }

  const data = (await response.json()) as { holidays: PublicHolidayRecord[] };
  return data.holidays;
}

export async function fetchPublicHolidayById(holidayId: string): Promise<PublicHolidayRecord> {
  const response = await fetch(`/api/scheduling/public-holidays/records/${holidayId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load public holiday');
  }

  return response.json() as Promise<PublicHolidayRecord>;
}

export async function createPublicHoliday(
  payload: PublicHolidayPayload,
): Promise<PublicHolidayRecord> {
  const response = await fetch('/api/scheduling/public-holidays/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as PublicHolidayRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as PublicHolidayRecord;
}

export async function updatePublicHoliday(
  holidayId: string,
  payload: PublicHolidayPayload,
): Promise<PublicHolidayRecord> {
  const response = await fetch(`/api/scheduling/public-holidays/records/${holidayId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as PublicHolidayRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as PublicHolidayRecord;
}

export async function deletePublicHoliday(holidayId: string): Promise<PublicHolidayRecord> {
  const response = await fetch(`/api/scheduling/public-holidays/records/${holidayId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as PublicHolidayRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as PublicHolidayRecord;
}
