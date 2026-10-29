import type { StenotypistLeavePayload, StenotypistLeaveRecord } from '../types/stenotypistLeave';
import { getAuthToken } from '../utils/auth';

export interface StenotypistLeaveCandidate {
  id: string;
  fullName: string;
  username: string;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchStenotypistLeaveRecords(): Promise<StenotypistLeaveRecord[]> {
  const response = await fetch('/api/scheduling/stenotypist-leaves/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist leave records');
  }

  const data = (await response.json()) as { leaves: StenotypistLeaveRecord[] };
  return data.leaves;
}

export async function fetchStenotypistLeaveById(leaveId: string): Promise<StenotypistLeaveRecord> {
  const response = await fetch(`/api/scheduling/stenotypist-leaves/records/${leaveId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist leave record');
  }

  return response.json() as Promise<StenotypistLeaveRecord>;
}

export async function fetchStenotypistLeaveCandidates(): Promise<StenotypistLeaveCandidate[]> {
  const response = await fetch('/api/scheduling/stenotypist-leaves/stenotypist-candidates', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist candidates');
  }

  const data = (await response.json()) as { candidates: StenotypistLeaveCandidate[] };
  return data.candidates;
}

export async function createStenotypistLeave(
  payload: StenotypistLeavePayload,
): Promise<StenotypistLeaveRecord> {
  const response = await fetch('/api/scheduling/stenotypist-leaves/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenotypistLeaveRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistLeaveRecord;
}

export async function updateStenotypistLeave(
  leaveId: string,
  payload: StenotypistLeavePayload,
): Promise<StenotypistLeaveRecord> {
  const response = await fetch(`/api/scheduling/stenotypist-leaves/records/${leaveId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenotypistLeaveRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistLeaveRecord;
}

export async function updateStenotypistLeaveStatus(
  leaveId: string,
  status: 'approved' | 'rejected',
): Promise<StenotypistLeaveRecord> {
  const response = await fetch(`/api/scheduling/stenotypist-leaves/records/${leaveId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });

  const data = (await response.json()) as StenotypistLeaveRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistLeaveRecord;
}

export async function deleteStenotypistLeave(leaveId: string): Promise<StenotypistLeaveRecord> {
  const response = await fetch(`/api/scheduling/stenotypist-leaves/records/${leaveId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as StenotypistLeaveRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistLeaveRecord;
}
