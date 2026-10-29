import { getAuthToken } from '../utils/auth';
import type {
  AuditTrailEntry,
  AuditTrailFilterOptions,
  FetchAuditTrailRecordsParams,
} from '../types/auditTrail';

async function auditTrailRequest<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return response.json() as Promise<T>;
}

function buildAuditTrailQuery(params: FetchAuditTrailRecordsParams): string {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  if (params.userId) search.set('userId', params.userId);
  if (params.module) search.set('module', params.module);
  if (params.entityName) search.set('entityName', params.entityName);
  if (params.entityNumber) search.set('entityNumber', params.entityNumber);
  if (params.entryType) search.set('entryType', params.entryType);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchAuditTrailRecords(
  params: FetchAuditTrailRecordsParams = {},
): Promise<AuditTrailEntry[]> {
  const response = await auditTrailRequest<{ entries: AuditTrailEntry[] }>(
    `/api/administration/audit-trail${buildAuditTrailQuery(params)}`,
  );
  return response.entries ?? [];
}

export async function fetchAuditTrailEntryById(entryId: string): Promise<AuditTrailEntry> {
  return auditTrailRequest<AuditTrailEntry>(
    `/api/administration/audit-trail/${encodeURIComponent(entryId)}`,
  );
}

export async function fetchAuditTrailFilterOptions(): Promise<AuditTrailFilterOptions> {
  return auditTrailRequest<AuditTrailFilterOptions>('/api/administration/audit-trail/options');
}
