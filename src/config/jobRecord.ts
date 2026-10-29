import type { JobReconciliationStatus, JobRejectionReason } from '../types/jobRecord';
import { JOB_REJECTION_REASON_OPTIONS } from '../types/jobRecord';
import type { TranslationKey } from '../i18n/translations';

const RECONCILIATION_LABEL_KEYS: Record<JobReconciliationStatus, TranslationKey> = {
  pending: 'jobReconciliationPending',
  correct: 'jobReconciliationCorrect',
  errors: 'jobReconciliationErrors',
};

const REJECTION_REASON_LABEL_KEYS: Record<JobRejectionReason, TranslationKey> = {
  scheduling_conflict: 'jobRejectionReasonSchedulingConflict',
  resource_unavailable: 'jobRejectionReasonResourceUnavailable',
  customer_cancelled: 'jobRejectionReasonCustomerCancelled',
  insufficient_information: 'jobRejectionReasonInsufficientInformation',
  other: 'jobRejectionReasonOther',
};

export { JOB_REJECTION_REASON_OPTIONS };

export function jobReconciliationStatusLabelKey(
  status: JobReconciliationStatus | string,
): TranslationKey {
  if ((['pending', 'correct', 'errors'] as const).includes(status as JobReconciliationStatus)) {
    return RECONCILIATION_LABEL_KEYS[status as JobReconciliationStatus];
  }
  return 'jobReconciliationPending';
}

export function jobRejectionReasonLabelKey(reason: JobRejectionReason | string): TranslationKey {
  if ((JOB_REJECTION_REASON_OPTIONS as readonly string[]).includes(reason)) {
    return REJECTION_REASON_LABEL_KEYS[reason as JobRejectionReason];
  }
  return 'jobRejectionReasonOther';
}
