import {
  JOB_SUBMISSION_STEP_OPTIONS,
  type JobSubmissionStepId,
} from '../types/jobSubmission';
import type { TranslationKey } from '../i18n/translations';

const STEP_LABEL_KEYS: Record<JobSubmissionStepId, TranslationKey> = {
  raw_files: 'jobSubmissionStepRawFiles',
  attachment_files: 'jobSubmissionStepAttachmentFiles',
  other_files: 'jobSubmissionStepOtherFiles',
  same_day_actions: 'jobSubmissionStepSameDayActions',
  job_receipt: 'jobSubmissionStepJobReceipt',
  final_validation: 'jobSubmissionStepFinalValidation',
};

export { JOB_SUBMISSION_STEP_OPTIONS };

export function jobSubmissionStepLabelKey(stepId: JobSubmissionStepId | string): TranslationKey {
  if ((JOB_SUBMISSION_STEP_OPTIONS as readonly string[]).includes(stepId)) {
    return STEP_LABEL_KEYS[stepId as JobSubmissionStepId];
  }
  return 'jobSubmissionStepRawFiles';
}

export function getJobSubmissionStepIndex(stepId: JobSubmissionStepId | string): number {
  return JOB_SUBMISSION_STEP_OPTIONS.indexOf(stepId as JobSubmissionStepId);
}

export function getJobSubmissionStepId(index: number): JobSubmissionStepId {
  return JOB_SUBMISSION_STEP_OPTIONS[Math.max(0, Math.min(index, JOB_SUBMISSION_STEP_OPTIONS.length - 1))];
}
