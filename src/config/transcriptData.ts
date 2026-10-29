import type { TranscriptFileEntry, TranscriptFilesBundle } from '../types/transcript';

export const TRANSCRIPT_FILE_CATEGORIES = [
  'rawFiles',
  'attachmentFiles',
  'otherFiles',
  'editedRawFiles',
  'reviewedRawFiles',
  'approvedTranscriptFile',
] as const;

export type TranscriptFileCategory = (typeof TRANSCRIPT_FILE_CATEGORIES)[number];

export const TRANSCRIPT_FILE_CATEGORY_LABEL_KEYS = {
  rawFiles: 'transcriptFilesRaw',
  attachmentFiles: 'transcriptFilesAttachments',
  otherFiles: 'transcriptFilesOther',
  editedRawFiles: 'transcriptFilesEditedRaw',
  reviewedRawFiles: 'transcriptFilesReviewedRaw',
  approvedTranscriptFile: 'transcriptFilesApproved',
} as const;

export function listTranscriptFilesForCategory(
  files: TranscriptFilesBundle,
  category: TranscriptFileCategory,
): TranscriptFileEntry[] {
  switch (category) {
    case 'rawFiles': {
      const raw = files.rawFiles ?? {};
      return [raw.rawZip, raw.transcriptWithTimestamps, raw.transcript].filter(
        (file): file is TranscriptFileEntry => Boolean(file?.name),
      );
    }
    case 'attachmentFiles': {
      const attachments = files.attachmentFiles ?? {};
      return [attachments.personalDictionary, attachments.evidenceList].filter(
        (file): file is TranscriptFileEntry => Boolean(file?.name),
      );
    }
    case 'otherFiles':
      return (files.otherFiles ?? []).filter((file) => Boolean(file?.name));
    case 'editedRawFiles':
      return files.editedRawFiles ?? [];
    case 'reviewedRawFiles':
      return files.reviewedRawFiles ?? [];
    case 'approvedTranscriptFile':
      return files.approvedTranscriptFile ? [files.approvedTranscriptFile] : [];
    default:
      return [];
  }
}

export function formatEditDuration(minutes: number): string {
  if (!minutes) return '0';
  return minutes.toFixed(1);
}
