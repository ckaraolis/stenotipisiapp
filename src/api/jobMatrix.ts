import type { JobMatrixView } from '../types/jobMatrix';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchJobMatrix(centerDate: string): Promise<JobMatrixView> {
  const params = new URLSearchParams({ centerDate });
  const response = await fetch(`/api/scheduling/job-matrix?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job matrix');
  }

  return response.json() as Promise<JobMatrixView>;
}
