import type {
  TranscriptAnalysisReportQuery,
  TranscriptAnalysisReportView,
  TranscriptListQuery,
  TranscriptListView,
  TranscriptParticipantOptions,
  TranscriptRecord,
  TranscriptReportView,
  TranscriptUpdatePayload,
  TranscriptUpdateResult,
  TranscriptWorkflowResult,
} from '../types/transcript';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTranscriptList(query: TranscriptListQuery): Promise<TranscriptListView> {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.jobStatus) params.set('jobStatus', query.jobStatus);
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.stenotypistUserId) params.set('stenotypistUserId', query.stenotypistUserId);
  if (query.editorUserId) params.set('editorUserId', query.editorUserId);
  if (query.reviewerUserId) params.set('reviewerUserId', query.reviewerUserId);
  if (query.transcriptOwnerUserId) params.set('transcriptOwnerUserId', query.transcriptOwnerUserId);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.search) params.set('search', query.search);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));

  const response = await fetch(`/api/transcripts?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load transcripts');
  }

  return response.json() as Promise<TranscriptListView>;
}

export async function fetchTranscriptById(transcriptId: string): Promise<TranscriptRecord> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load transcript');
  }

  return response.json() as Promise<TranscriptRecord>;
}

export async function fetchTranscriptParticipantOptions(): Promise<TranscriptParticipantOptions> {
  const response = await fetch('/api/transcripts/options/participants', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load transcript participant options');
  }

  return response.json() as Promise<TranscriptParticipantOptions>;
}

export async function updateTranscript(
  transcriptId: string,
  payload: TranscriptUpdatePayload,
): Promise<TranscriptUpdateResult> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TranscriptUpdateResult & { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

export async function submitEditedTranscriptWorkflow(
  transcriptId: string,
  payload: {
    name: string;
    type: string;
    contentBase64: string;
    sgxmlContent?: string;
    remarks?: string;
  },
): Promise<TranscriptWorkflowResult> {
  const response = await fetch(
    `/api/transcripts/${encodeURIComponent(transcriptId)}/workflow/edited`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = (await response.json()) as TranscriptWorkflowResult & { errors?: string[] };
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function submitReviewedTranscriptWorkflow(
  transcriptId: string,
  payload: { name: string; type: string; contentBase64: string; remarks?: string },
): Promise<TranscriptWorkflowResult> {
  const response = await fetch(
    `/api/transcripts/${encodeURIComponent(transcriptId)}/workflow/reviewed`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = (await response.json()) as TranscriptWorkflowResult & { errors?: string[] };
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function publishTranscriptWorkflow(
  transcriptId: string,
  payload: { publisherRemarks?: string },
): Promise<TranscriptWorkflowResult> {
  const response = await fetch(
    `/api/transcripts/${encodeURIComponent(transcriptId)}/workflow/publish`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = (await response.json()) as TranscriptWorkflowResult & { errors?: string[] };
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function fetchTranscriptReport(transcriptId: string): Promise<TranscriptReportView> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}/report`, {
    headers: authHeaders(),
  });
  const data = (await response.json()) as TranscriptReportView & { errors?: string[] };
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function fetchTranscriptsAnalysisReport(
  query: TranscriptAnalysisReportQuery = {},
): Promise<TranscriptAnalysisReportView> {
  const params = new URLSearchParams();
  if (query.jobStatus) params.set('jobStatus', query.jobStatus);
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.search) params.set('search', query.search);

  const response = await fetch(`/api/transcripts/analysis-report?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load transcripts analysis report');
  }

  return response.json() as Promise<TranscriptAnalysisReportView>;
}
