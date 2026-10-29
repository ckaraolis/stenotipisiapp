import type { ProjectPayload, ProjectRecord } from '../types/project';
import { getAuthToken } from '../utils/auth';

export interface TranscriptOwnerCandidate {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchProjectRecords(): Promise<ProjectRecord[]> {
  const response = await fetch('/api/projects/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load projects');
  }

  const data = (await response.json()) as { projects: ProjectRecord[] };
  return data.projects;
}

export async function fetchProjectById(projectId: string): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/records/${projectId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load project');
  }

  return response.json() as Promise<ProjectRecord>;
}

export async function createProject(payload: ProjectPayload): Promise<ProjectRecord> {
  const response = await fetch('/api/projects/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ProjectRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectRecord;
}

export async function updateProject(
  projectId: string,
  payload: ProjectPayload,
): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/records/${projectId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ProjectRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectRecord;
}

export async function updateProjectStatus(
  projectId: string,
  status: 'open' | 'closed',
): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/records/${projectId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });

  const data = (await response.json()) as ProjectRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectRecord;
}

export async function deleteProject(projectId: string): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/records/${projectId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as ProjectRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectRecord;
}

export async function fetchTranscriptOwnerCandidates(
  customerId: string,
  excludeUserIds: string[] = [],
): Promise<TranscriptOwnerCandidate[]> {
  const exclude = excludeUserIds.length > 0 ? `&exclude=${excludeUserIds.join(',')}` : '';
  const response = await fetch(
    `/api/projects/transcript-owner-candidates?customerId=${encodeURIComponent(customerId)}${exclude}`,
    { headers: authHeaders() },
  );

  const data = (await response.json()) as
    | { candidates: TranscriptOwnerCandidate[] }
    | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return (data as { candidates: TranscriptOwnerCandidate[] }).candidates;
}
