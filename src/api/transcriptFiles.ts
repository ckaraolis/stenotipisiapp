import type {
  TranscriptFileMutationResult,
  TranscriptFileUpdatePayload,
  TranscriptFileUploadPayload,
  TranscriptFilesListView,
  TranscriptFileVersion,
} from '../types/transcript';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTranscriptFilesList(transcriptId: string): Promise<TranscriptFilesListView> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}/file-list`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load transcript files');
  }

  return response.json() as Promise<TranscriptFilesListView>;
}

export async function addTranscriptOtherFile(
  transcriptId: string,
  payload: TranscriptFileUploadPayload,
): Promise<TranscriptFileMutationResult> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TranscriptFileMutationResult & { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

export async function updateTranscriptFile(
  transcriptId: string,
  payload: TranscriptFileUpdatePayload,
): Promise<TranscriptFileMutationResult> {
  const response = await fetch(`/api/transcripts/${encodeURIComponent(transcriptId)}/files`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TranscriptFileMutationResult & { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

export async function fetchTranscriptFileHistory(
  transcriptId: string,
  slot: string,
  fileId: string,
): Promise<TranscriptFileVersion[]> {
  const params = new URLSearchParams({ slot, fileId });
  const response = await fetch(
    `/api/transcripts/${encodeURIComponent(transcriptId)}/files/history?${params.toString()}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    throw new Error('Failed to load transcript file history');
  }

  const data = (await response.json()) as { history: TranscriptFileVersion[] };
  return data.history;
}

export async function downloadTranscriptFile(
  transcriptId: string,
  slot: string,
  fileId: string,
  fileName: string,
): Promise<void> {
  const params = new URLSearchParams({ slot, fileId });
  const token = getAuthToken();
  const response = await fetch(
    `/api/transcripts/${encodeURIComponent(transcriptId)}/files/download?${params.toString()}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { errors?: string[] };
    throw new Error(JSON.stringify(data));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
