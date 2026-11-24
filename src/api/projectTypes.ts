import type {
  ProjectTypeImportResult,
  ProjectTypeImportRow,
  ProjectTypeOption,
  ProjectTypePayload,
  ProjectTypeRecord,
} from '../types/projectType';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchProjectTypeOptions(customerId?: string): Promise<ProjectTypeOption[]> {
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  const query = params.toString();
  const response = await fetch(`/api/project-types${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load project types');
  }

  const data = (await response.json()) as { projectTypes: ProjectTypeOption[] };
  return data.projectTypes;
}

export async function fetchProjectTypeRecords(): Promise<ProjectTypeRecord[]> {
  const response = await fetch('/api/project-types/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load project types');
  }

  const data = (await response.json()) as { projectTypes: ProjectTypeRecord[] };
  return data.projectTypes;
}

export async function fetchProjectTypeById(projectTypeId: string): Promise<ProjectTypeRecord> {
  const response = await fetch(`/api/project-types/records/${projectTypeId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load project type');
  }

  return response.json() as Promise<ProjectTypeRecord>;
}

export async function createProjectType(payload: ProjectTypePayload): Promise<ProjectTypeRecord> {
  const response = await fetch('/api/project-types/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ProjectTypeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectTypeRecord;
}

export async function updateProjectType(
  projectTypeId: string,
  payload: ProjectTypePayload,
): Promise<ProjectTypeRecord> {
  const response = await fetch(`/api/project-types/records/${projectTypeId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ProjectTypeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectTypeRecord;
}

export async function updateProjectTypeStatus(
  projectTypeId: string,
  enabled: boolean,
): Promise<ProjectTypeRecord> {
  const response = await fetch(`/api/project-types/records/${projectTypeId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ enabled }),
  });

  const data = (await response.json()) as ProjectTypeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectTypeRecord;
}

export async function deleteProjectType(projectTypeId: string): Promise<ProjectTypeRecord> {
  const response = await fetch(`/api/project-types/records/${projectTypeId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as ProjectTypeRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectTypeRecord;
}

export async function importProjectTypeRows(
  rows: ProjectTypeImportRow[],
): Promise<ProjectTypeImportResult> {
  const response = await fetch('/api/project-types/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rows }),
  });

  const data = (await response.json()) as ProjectTypeImportResult | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProjectTypeImportResult;
}
