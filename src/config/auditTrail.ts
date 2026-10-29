import type { TranslationKey } from '../i18n/translations';
import type { AuditTrailUserOption } from '../types/auditTrail';
import {
  AUDIT_ENTITY_NAMES,
  AUDIT_ENTRY_TYPES,
  AUDIT_MODULES,
} from '../types/auditTrail';

export const AUDIT_TRAIL_PAGE_SIZE = 20;

export function getTodayDateRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  return { from: today, to: today };
}

/** Format ISO timestamp as dd/mm/yy hh:mm:ss */
export function formatAuditTrailTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp || '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatAuditTrailUserLabel(
  user: Pick<AuditTrailUserOption, 'fullName' | 'username'>,
): string {
  if (user.fullName?.trim()) {
    return user.username?.trim() ? `${user.fullName} (${user.username})` : user.fullName;
  }
  return user.username || '—';
}

export function auditModuleLabelKey(module: string): TranslationKey {
  switch (module) {
    case 'scheduling':
      return 'auditModule_scheduling';
    case 'transcripts':
      return 'auditModule_transcripts';
    case 'projects':
      return 'auditModule_projects';
    case 'financials':
      return 'auditModule_financials';
    case 'administration':
      return 'auditModule_administration';
    case 'dashboard':
      return 'auditModule_dashboard';
    default:
      return 'auditModule_unknown';
  }
}

export function auditEntityNameLabelKey(entityName: string): TranslationKey {
  switch (entityName) {
    case 'job':
      return 'auditEntity_job';
    case 'job_allocation':
      return 'auditEntity_job_allocation';
    case 'stenotypist_leave':
      return 'auditEntity_stenotypist_leave';
    case 'public_holiday':
      return 'auditEntity_public_holiday';
    case 'travelling_time':
      return 'auditEntity_travelling_time';
    case 'transcript':
      return 'auditEntity_transcript';
    case 'customer':
      return 'auditEntity_customer';
    case 'project':
      return 'auditEntity_project';
    case 'district':
      return 'auditEntity_district';
    case 'travelling_charge':
      return 'auditEntity_travelling_charge';
    case 'job_reconciliation':
      return 'auditEntity_job_reconciliation';
    case 'proforma':
      return 'auditEntity_proforma';
    case 'stenotypist_bonus':
      return 'auditEntity_stenotypist_bonus';
    case 'stenotypist_penalty':
      return 'auditEntity_stenotypist_penalty';
    case 'travel_expense':
      return 'auditEntity_travel_expense';
    case 'job_travel_expense':
      return 'auditEntity_job_travel_expense';
    case 'user':
      return 'auditEntity_user';
    case 'stenotypist_asset':
      return 'auditEntity_stenotypist_asset';
    case 'notification':
      return 'auditEntity_notification';
    case 'account':
      return 'auditEntity_account';
    case 'program_access':
      return 'auditEntity_program_access';
    case 'session':
      return 'auditEntity_program_access';
    case 'customer_fields':
      return 'auditEntity_customer_fields';
    default:
      return 'auditEntity_unknown';
  }
}

export function auditEntryTypeLabelKey(entryType: string): TranslationKey {
  switch (entryType) {
    case 'created':
      return 'auditEntryType_created';
    case 'updated':
      return 'auditEntryType_updated';
    case 'deleted':
      return 'auditEntryType_deleted';
    case 'downloaded':
      return 'auditEntryType_downloaded';
    case 'uploaded':
      return 'auditEntryType_uploaded';
    case 'exported':
      return 'auditEntryType_exported';
    case 'role_assigned':
      return 'auditEntryType_role_assigned';
    case 'role_unassigned':
      return 'auditEntryType_role_unassigned';
    case 'transcript_owner_added':
      return 'auditEntryType_transcript_owner_added';
    case 'transcript_owner_removed':
      return 'auditEntryType_transcript_owner_removed';
    case 'raw_files_uploaded':
      return 'auditEntryType_raw_files_uploaded';
    case 'attachments_uploaded':
      return 'auditEntryType_attachments_uploaded';
    case 'other_files_uploaded':
      return 'auditEntryType_other_files_uploaded';
    case 'same_day_actions_updated':
      return 'auditEntryType_same_day_actions_updated';
    case 'session_opened':
      return 'auditEntryType_session_opened';
    case 'session_closed':
      return 'auditEntryType_session_closed';
    default:
      return 'auditEntryType_unknown';
  }
}

export function parseAuditEntryDetails(
  entryType: string,
  entryDetails: string,
): import('../types/auditTrail').ParsedAuditEntryDetails {
  if (
    !entryDetails?.trim() ||
    entryType === 'deleted' ||
    entryType === 'session_closed'
  ) {
    return { kind: 'empty' };
  }

  try {
    const parsed = JSON.parse(entryDetails) as Record<string, unknown>;

    if (
      (entryType === 'created' ||
        entryType === 'exported' ||
        entryType === 'role_assigned' ||
        entryType === 'role_unassigned' ||
        entryType === 'transcript_owner_added' ||
        entryType === 'transcript_owner_removed') &&
      Array.isArray(parsed.fields)
    ) {
      return {
        kind: 'created',
        fields: parsed.fields.map((field) => {
          const row = field as { label?: unknown; data?: unknown };
          return {
            label: String(row.label ?? ''),
            data: String(row.data ?? ''),
          };
        }),
      };
    }

    if (
      (entryType === 'updated' || entryType === 'same_day_actions_updated') &&
      Array.isArray(parsed.fields)
    ) {
      return {
        kind: 'updated',
        fields: parsed.fields.map((field) => {
          const row = field as { label?: unknown; oldData?: unknown; newData?: unknown };
          return {
            label: String(row.label ?? ''),
            oldData: String(row.oldData ?? ''),
            newData: String(row.newData ?? ''),
          };
        }),
      };
    }

    if (
      entryType === 'uploaded' ||
      entryType === 'downloaded' ||
      entryType === 'raw_files_uploaded' ||
      entryType === 'attachments_uploaded' ||
      entryType === 'other_files_uploaded'
    ) {
      return {
        kind: 'file_transfer',
        fileSize: String(parsed.fileSize ?? ''),
        duration: String(parsed.duration ?? ''),
      };
    }

    if (entryType === 'session_opened') {
      return {
        kind: 'session_opened',
        userAgentString: String(parsed.userAgentString ?? ''),
      };
    }
  } catch {
    // Fall through to plain text for legacy entries.
  }

  return { kind: 'text', text: entryDetails };
}

export function formatParsedAuditEntryDetails(
  parsed: import('../types/auditTrail').ParsedAuditEntryDetails,
  labels: {
    dataLabel: string;
    data: string;
    oldData: string;
    newData: string;
    fileSize: string;
    duration: string;
    userAgentString: string;
  },
): string {
  switch (parsed.kind) {
    case 'empty':
      return '';
    case 'text':
      return parsed.text;
    case 'created':
      return parsed.fields
        .map((field) => `${labels.dataLabel}: ${field.label}\n${labels.data}: ${field.data || '—'}`)
        .join('\n\n');
    case 'updated':
      return parsed.fields
        .map(
          (field) =>
            `${labels.dataLabel}: ${field.label}\n${labels.oldData}: ${field.oldData || '—'}\n${labels.newData}: ${field.newData || '—'}`,
        )
        .join('\n\n');
    case 'file_transfer':
      return `${labels.fileSize}: ${parsed.fileSize || '—'}\n${labels.duration}: ${parsed.duration || '—'}`;
    case 'session_opened':
      return `${labels.userAgentString}: ${parsed.userAgentString || '—'}`;
    default:
      return '';
  }
}

export const AUDIT_MODULE_OPTIONS = [...AUDIT_MODULES];
export const AUDIT_ENTITY_NAME_OPTIONS = [...AUDIT_ENTITY_NAMES];
export const AUDIT_ENTRY_TYPE_OPTIONS = [...AUDIT_ENTRY_TYPES];
