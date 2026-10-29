import type { TravellingTimePayload, TravellingTimeRecord } from '../types/travellingTime';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTravellingTimeRecords(): Promise<TravellingTimeRecord[]> {
  const response = await fetch('/api/scheduling/travelling-times/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load travelling time records');
  }

  const data = (await response.json()) as { trips: TravellingTimeRecord[] };
  return data.trips;
}

export async function fetchTravellingTimeById(tripId: string): Promise<TravellingTimeRecord> {
  const response = await fetch(`/api/scheduling/travelling-times/records/${tripId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load travelling time record');
  }

  return response.json() as Promise<TravellingTimeRecord>;
}

export async function createTravellingTime(
  payload: TravellingTimePayload,
): Promise<TravellingTimeRecord> {
  const response = await fetch('/api/scheduling/travelling-times/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TravellingTimeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingTimeRecord;
}

export async function updateTravellingTime(
  tripId: string,
  payload: TravellingTimePayload,
): Promise<TravellingTimeRecord> {
  const response = await fetch(`/api/scheduling/travelling-times/records/${tripId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TravellingTimeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingTimeRecord;
}

export async function deleteTravellingTime(tripId: string): Promise<TravellingTimeRecord> {
  const response = await fetch(`/api/scheduling/travelling-times/records/${tripId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as TravellingTimeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as TravellingTimeRecord;
}
