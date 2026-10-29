import type { JobSubmissionFileEntry, JobSubmissionAttachmentFilesBundle } from '../types/jobSubmission';

export const JOB_SUBMISSION_ATTACHMENT_FILE_SLOTS = [
  'personal_dictionary',
  'evidence_list',
] as const;

export type JobSubmissionAttachmentFileSlot =
  (typeof JOB_SUBMISSION_ATTACHMENT_FILE_SLOTS)[number];

const JOB_NUMBER_PATTERN = /^JB\d{6}$/;

export function emptyAttachmentFilesBundle(): JobSubmissionAttachmentFilesBundle {
  return {
    personalDictionary: null,
    evidenceList: null,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function getBaseName(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(0, index) : fileName;
}

export function acceptFilterForAttachmentFileSlot(slot: JobSubmissionAttachmentFileSlot): string {
  return slot === 'personal_dictionary' ? '.rtf' : '.doc,.docx';
}

function matchesJobFilenamePattern(jobNumber: string, fileName: string): boolean {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

function personalDictionaryBaseNameIsValid(jobNumber: string, baseName: string): boolean {
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_D_\\d{6}$`, 'i');
  return pattern.test(baseName);
}

export function validateAttachmentFileName(
  jobNumber: string,
  fileName: string,
  slot: JobSubmissionAttachmentFileSlot,
): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return 'jobSubmissionAttachmentFileRequired';

  const extension = getExtension(trimmed);

  if (slot === 'personal_dictionary') {
    if (extension !== 'rtf') {
      return 'jobSubmissionPersonalDictionaryExtensionInvalid';
    }
    if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
      return 'jobSubmissionAttachmentFileJobNumberInvalid';
    }
    const baseName = getBaseName(trimmed);
    if (!personalDictionaryBaseNameIsValid(jobNumber, baseName)) {
      return 'jobSubmissionPersonalDictionaryFilenameMustEndWithD';
    }
    return null;
  }

  if (extension !== 'doc' && extension !== 'docx') {
    return 'jobSubmissionEvidenceListExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'jobSubmissionAttachmentFileJobNumberInvalid';
  }

  return null;
}

export function validateAttachmentFilesBundle(
  jobNumber: string,
  bundle: JobSubmissionAttachmentFilesBundle,
): string[] {
  const errors: string[] = [];
  const slots: Array<{
    slot: JobSubmissionAttachmentFileSlot;
    file: JobSubmissionFileEntry | null;
  }> = [
    { slot: 'personal_dictionary', file: bundle.personalDictionary },
    { slot: 'evidence_list', file: bundle.evidenceList },
  ];

  for (const { slot, file } of slots) {
    if (!file?.name) continue;
    const nameError = validateAttachmentFileName(jobNumber, file.name, slot);
    if (nameError) errors.push(nameError);
  }

  return [...new Set(errors)];
}

export function countAttachmentFilesBundle(bundle: JobSubmissionAttachmentFilesBundle): number {
  return [bundle.personalDictionary, bundle.evidenceList].filter(Boolean).length;
}
