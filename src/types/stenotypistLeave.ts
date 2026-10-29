export const STENOTYPIST_LEAVE_REASON_OPTIONS = [
  'sick_leave',
  'maternity_leave',
  'annual_leave',
  'other',
] as const;

export const STENOTYPIST_LEAVE_STATUS_OPTIONS = ['new', 'approved', 'rejected'] as const;

export type StenotypistLeaveReason = (typeof STENOTYPIST_LEAVE_REASON_OPTIONS)[number];
export type StenotypistLeaveStatus = (typeof STENOTYPIST_LEAVE_STATUS_OPTIONS)[number];

export interface StenotypistLeaveHistoryEntry {
  id: string;
  status: StenotypistLeaveStatus;
  changedAt: string;
  changedByUserId: string | null;
  changedByName: string;
  notes: string;
}

export interface StenotypistLeaveRecord {
  id: string;
  stenotypistUserId: string;
  stenotypistName: string;
  stenotypistUsername: string;
  dateFrom: string;
  dateTo: string;
  reason: StenotypistLeaveReason | '';
  status: StenotypistLeaveStatus;
  history: StenotypistLeaveHistoryEntry[];
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistLeavePayload {
  stenotypistUserId: string;
  dateFrom: string;
  dateTo: string;
  reason: StenotypistLeaveReason | string;
  status?: StenotypistLeaveStatus | string;
}
