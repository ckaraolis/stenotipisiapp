import type { TranslationKey } from '../i18n/translations';
import {
  STENOTYPIST_LEAVE_REASON_OPTIONS,
  STENOTYPIST_LEAVE_STATUS_OPTIONS,
  type StenotypistLeaveReason,
  type StenotypistLeaveStatus,
} from '../types/stenotypistLeave';

const REASON_LABEL_KEYS: Record<StenotypistLeaveReason, TranslationKey> = {
  sick_leave: 'leaveReasonSickLeave',
  maternity_leave: 'leaveReasonMaternityLeave',
  annual_leave: 'leaveReasonAnnualLeave',
  other: 'leaveReasonOther',
};

const STATUS_LABEL_KEYS: Record<StenotypistLeaveStatus, TranslationKey> = {
  new: 'leaveStatusNew',
  approved: 'leaveStatusApproved',
  rejected: 'leaveStatusRejected',
};

export { STENOTYPIST_LEAVE_REASON_OPTIONS, STENOTYPIST_LEAVE_STATUS_OPTIONS };

export function stenotypistLeaveReasonLabelKey(
  reason: StenotypistLeaveReason | string,
): TranslationKey {
  if ((STENOTYPIST_LEAVE_REASON_OPTIONS as readonly string[]).includes(reason)) {
    return REASON_LABEL_KEYS[reason as StenotypistLeaveReason];
  }
  return 'leaveReasonOther';
}

export function stenotypistLeaveStatusLabelKey(
  status: StenotypistLeaveStatus | string,
): TranslationKey {
  if ((STENOTYPIST_LEAVE_STATUS_OPTIONS as readonly string[]).includes(status)) {
    return STATUS_LABEL_KEYS[status as StenotypistLeaveStatus];
  }
  return 'leaveStatusNew';
}

export function formatStenotypistLeaveLabel(record: {
  stenotypistUsername: string;
  stenotypistName: string;
}): string {
  if (record.stenotypistUsername && record.stenotypistName) {
    return `${record.stenotypistUsername} – ${record.stenotypistName}`;
  }
  return record.stenotypistName || record.stenotypistUsername || '—';
}

export function formatRequestedOn(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
