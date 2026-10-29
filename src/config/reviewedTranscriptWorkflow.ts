import type { TranslationKey } from '../i18n/translations';

export const REVIEWED_TRANSCRIPT_WORKFLOW_STEPS = [
  'reviewed_transcript_upload',
  'final_validation',
] as const;

export type ReviewedTranscriptWorkflowStepId = (typeof REVIEWED_TRANSCRIPT_WORKFLOW_STEPS)[number];

const STEP_LABEL_KEYS: Record<ReviewedTranscriptWorkflowStepId, TranslationKey> = {
  reviewed_transcript_upload: 'transcriptReviewedStepUpload',
  final_validation: 'transcriptReviewedStepFinalValidation',
};

const JOB_NUMBER_PATTERN = /^JB\d{6}$/;
const REVIEWED_EXTENSIONS = new Set(['doc', 'docx']);

export const REVIEWED_TRANSCRIPT_FILE_ACCEPT = '.doc,.docx';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function matchesJobFilenamePattern(jobNumber: string, fileName: string): boolean {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

/** §2.7.3 — Validate reviewed transcript .doc/.docx filename for the job. */
export function validateReviewedTranscriptFileName(
  jobNumber: string,
  fileName: string,
): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return 'transcriptReviewedTranscriptRequired';

  if (!REVIEWED_EXTENSIONS.has(getExtension(trimmed))) {
    return 'transcriptReviewedTranscriptExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'transcriptReviewedTranscriptFilenameInvalid';
  }

  return null;
}

export function reviewedTranscriptStepLabelKey(
  stepId: ReviewedTranscriptWorkflowStepId | string,
): TranslationKey {
  if ((REVIEWED_TRANSCRIPT_WORKFLOW_STEPS as readonly string[]).includes(stepId)) {
    return STEP_LABEL_KEYS[stepId as ReviewedTranscriptWorkflowStepId];
  }
  return 'transcriptReviewedStepUpload';
}

export function getReviewedTranscriptStepIndex(
  stepId: ReviewedTranscriptWorkflowStepId | string,
): number {
  return REVIEWED_TRANSCRIPT_WORKFLOW_STEPS.indexOf(stepId as ReviewedTranscriptWorkflowStepId);
}

export function getReviewedTranscriptStepId(index: number): ReviewedTranscriptWorkflowStepId {
  return REVIEWED_TRANSCRIPT_WORKFLOW_STEPS[
    Math.max(0, Math.min(index, REVIEWED_TRANSCRIPT_WORKFLOW_STEPS.length - 1))
  ];
}
