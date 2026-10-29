import type { TranslationKey } from '../i18n/translations';

export const EDITED_TRANSCRIPT_WORKFLOW_STEPS = [
  'edited_transcript_upload',
  'final_validation',
] as const;

export type EditedTranscriptWorkflowStepId = (typeof EDITED_TRANSCRIPT_WORKFLOW_STEPS)[number];

const STEP_LABEL_KEYS: Record<EditedTranscriptWorkflowStepId, TranslationKey> = {
  edited_transcript_upload: 'transcriptEditedStepUpload',
  final_validation: 'transcriptEditedStepFinalValidation',
};

const JOB_NUMBER_PATTERN = /^JB\d{6}$/;

export const EDITED_TRANSCRIPT_FILE_ACCEPT = '.zip';

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

/** §2.6.3 — Validate edited transcript .zip filename for the job. */
export function validateEditedTranscriptFileName(
  jobNumber: string,
  fileName: string,
): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return 'transcriptEditedTranscriptRequired';

  if (getExtension(trimmed) !== 'zip') {
    return 'transcriptEditedTranscriptExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'transcriptEditedTranscriptFilenameInvalid';
  }

  return null;
}

export function editedTranscriptStepLabelKey(
  stepId: EditedTranscriptWorkflowStepId | string,
): TranslationKey {
  if ((EDITED_TRANSCRIPT_WORKFLOW_STEPS as readonly string[]).includes(stepId)) {
    return STEP_LABEL_KEYS[stepId as EditedTranscriptWorkflowStepId];
  }
  return 'transcriptEditedStepUpload';
}

export function getEditedTranscriptStepIndex(stepId: EditedTranscriptWorkflowStepId | string): number {
  return EDITED_TRANSCRIPT_WORKFLOW_STEPS.indexOf(stepId as EditedTranscriptWorkflowStepId);
}

export function getEditedTranscriptStepId(index: number): EditedTranscriptWorkflowStepId {
  return EDITED_TRANSCRIPT_WORKFLOW_STEPS[
    Math.max(0, Math.min(index, EDITED_TRANSCRIPT_WORKFLOW_STEPS.length - 1))
  ];
}
