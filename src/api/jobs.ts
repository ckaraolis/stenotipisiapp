import type { JobPayload, JobRecord } from '../types/jobRecord';
import type { JobSubmissionPayload, JobSubmissionRecord } from '../types/jobSubmission';
import type {
  JobActionId,
  JobAssignmentRole,
  JobPhase,
  JobStatus,
} from '../types/job';
import type { UserRole } from '../config/roles';
import { getAuthToken } from '../utils/auth';

export interface JobWorkflowActionDto {
  id: JobActionId;
  atStatus: JobStatus | null;
  toStatus: JobStatus;
  phase: JobPhase;
  roles: UserRole[];
  assignmentRoles?: JobAssignmentRole[];
  createEntry?: boolean;
}

export interface JobCrossCuttingActionDto {
  id: 'reject_job' | 'delete_job';
  toStatus: JobStatus;
  roles: UserRole[];
  fromStatuses: JobStatus[];
}

export interface JobCatalog {
  phases: JobPhase[];
  statuses: JobStatus[];
  phaseOrder: JobPhase[];
  statusWorkflowOrder: JobStatus[];
  phaseStatuses: Record<JobPhase, JobStatus[]>;
  statusPhase: Record<JobStatus, JobPhase>;
  transitions: Record<JobStatus, JobStatus[]>;
  assignmentRoles: JobAssignmentRole[];
  customerRoles: UserRole[];
  astraeaRoles: UserRole[];
  workflowActions: JobWorkflowActionDto[];
  crossCuttingActions: JobCrossCuttingActionDto[];
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchJobCatalog(): Promise<JobCatalog> {
  const response = await fetch('/api/scheduling/jobs/options', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job catalog');
  }

  return response.json() as Promise<JobCatalog>;
}

export async function fetchJobRecords(): Promise<JobRecord[]> {
  const response = await fetch('/api/scheduling/jobs/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job records');
  }

  const data = (await response.json()) as { jobs: JobRecord[] };
  return data.jobs;
}

export async function fetchJobById(jobId: string): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load job record');
  }

  return response.json() as Promise<JobRecord>;
}

export async function createJob(payload: JobPayload): Promise<JobRecord> {
  const response = await fetch('/api/scheduling/jobs/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function updateJob(jobId: string, payload: JobPayload): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function deleteJob(jobId: string): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function approveJob(jobId: string): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function rejectJob(
  jobId: string,
  payload: { rejectionReason: string },
): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function assignJob(
  jobId: string,
  payload: { stenotypistUserId: string },
): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/assign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function matrixAllocateJob(
  jobId: string,
  payload: { stenotypistUserId: string; date: string },
): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/matrix-allocate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function matrixUnassignJob(jobId: string): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/matrix-unassign`, {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function confirmJob(jobId: string): Promise<JobRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as JobRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobRecord;
}

export async function confirmAllPendingJobs(): Promise<{ count: number; jobs: JobRecord[] }> {
  const response = await fetch('/api/scheduling/jobs/records/confirm-all', {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as
    | { count: number; jobs: JobRecord[] }
    | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as { count: number; jobs: JobRecord[] };
}

export interface JobStenotypistCandidate {
  id: string;
  fullName: string;
  username: string;
}

export async function fetchJobStenotypistCandidates(): Promise<JobStenotypistCandidate[]> {
  const response = await fetch('/api/scheduling/jobs/stenotypist-candidates', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist candidates');
  }

  const data = (await response.json()) as { stenotypists: JobStenotypistCandidate[] };
  return data.stenotypists;
}

export async function fetchJobSubmission(jobId: string): Promise<JobSubmissionRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/submission`, {
    headers: authHeaders(),
  });

  const data = (await response.json()) as JobSubmissionRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobSubmissionRecord;
}

export async function saveJobSubmission(
  jobId: string,
  payload: JobSubmissionPayload,
): Promise<JobSubmissionRecord> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/submission`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as JobSubmissionRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as JobSubmissionRecord;
}

export async function completeJobSubmission(
  jobId: string,
  payload: JobSubmissionPayload,
): Promise<{ submission: JobSubmissionRecord; completed: boolean; job?: JobRecord }> {
  const response = await fetch(`/api/scheduling/jobs/records/${jobId}/submission/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as
    | { submission: JobSubmissionRecord; completed: boolean; job?: JobRecord }
    | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as { submission: JobSubmissionRecord; completed: boolean; job?: JobRecord };
}
