export const AUDIT_MODULES = [
  'scheduling',
  'transcripts',
  'projects',
  'financials',
  'administration',
  'dashboard',
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_ENTITY_NAMES = [
  'job',
  'job_allocation',
  'stenotypist_leave',
  'public_holiday',
  'travelling_time',
  'transcript',
  'customer',
  'project',
  'district',
  'travelling_charge',
  'job_reconciliation',
  'proforma',
  'stenotypist_bonus',
  'stenotypist_penalty',
  'travel_expense',
  'job_travel_expense',
  'user',
  'stenotypist_asset',
  'notification',
  'account',
  'program_access',
  'customer_fields',
] as const;

export type AuditEntityName = (typeof AUDIT_ENTITY_NAMES)[number];

export const AUDIT_ENTRY_TYPES = [
  'created',
  'updated',
  'deleted',
  'downloaded',
  'uploaded',
  'exported',
  'role_assigned',
  'role_unassigned',
  'transcript_owner_added',
  'transcript_owner_removed',
  'raw_files_uploaded',
  'attachments_uploaded',
  'other_files_uploaded',
  'same_day_actions_updated',
  'session_opened',
  'session_closed',
] as const;

export type AuditEntryType = (typeof AUDIT_ENTRY_TYPES)[number];

export type AuditTrailUserOption = {
  id: string;
  fullName: string;
  username: string;
};

export type AuditTrailEntry = {
  id: string;
  timestamp: string;
  userId: string;
  userFullName: string;
  userUsername: string;
  module: string;
  entityName: string;
  entityNumber: string;
  entryType: string;
  entryDetails: string;
};

export type AuditCreatedFieldDetail = {
  label: string;
  data: string;
};

export type AuditUpdatedFieldDetail = {
  label: string;
  oldData: string;
  newData: string;
};

export type AuditFileTransferDetails = {
  fileSize: string;
  duration: string;
};

export type AuditSessionOpenedDetails = {
  userAgentString: string;
};

export type ParsedAuditEntryDetails =
  | { kind: 'created'; fields: AuditCreatedFieldDetail[] }
  | { kind: 'updated'; fields: AuditUpdatedFieldDetail[] }
  | { kind: 'file_transfer'; fileSize: string; duration: string }
  | { kind: 'session_opened'; userAgentString: string }
  | { kind: 'empty' }
  | { kind: 'text'; text: string };

export type AuditTrailFilterOptions = {
  users: AuditTrailUserOption[];
  modules: string[];
  entityNames: string[];
  entryTypes: string[];
};

export type FetchAuditTrailRecordsParams = {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  module?: string;
  entityName?: string;
  entityNumber?: string;
  entryType?: string;
};
