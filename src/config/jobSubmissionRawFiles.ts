import type { JobSubmissionFileEntry, JobSubmissionRawFilesBundle } from '../types/jobSubmission';

export const JOB_SUBMISSION_RAW_FILE_SLOTS = [
  'raw_zip',
  'transcript_timestamps',
  'transcript_rtf',
] as const;

export type JobSubmissionRawFileSlot = (typeof JOB_SUBMISSION_RAW_FILE_SLOTS)[number];

const JOB_NUMBER_PATTERN = /^JB\d{6}$/;

export function emptyRawFilesBundle(): JobSubmissionRawFilesBundle {
  return {
    rawZip: null,
    transcriptWithTimestamps: null,
    transcript: null,
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

export function expectedExtensionForRawFileSlot(slot: JobSubmissionRawFileSlot): string {
  switch (slot) {
    case 'raw_zip':
      return 'zip';
    case 'transcript_timestamps':
      return 'txt';
    case 'transcript_rtf':
      return 'rtf';
    default:
      return '';
  }
}

export function acceptFilterForRawFileSlot(slot: JobSubmissionRawFileSlot): string {
  return `.${expectedExtensionForRawFileSlot(slot)}`;
}

function matchesJobFilenamePattern(jobNumber: string, fileName: string): boolean {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

function transcriptBaseNameIsValid(jobNumber: string, baseName: string): boolean {
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_T_\\d{6}$`, 'i');
  return pattern.test(baseName);
}

export function validateRawFileName(
  jobNumber: string,
  fileName: string,
  slot: JobSubmissionRawFileSlot,
): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return 'jobSubmissionRawFileRequired';

  const extension = getExtension(trimmed);
  const expectedExtension = expectedExtensionForRawFileSlot(slot);
  if (extension !== expectedExtension) {
    return slot === 'raw_zip'
      ? 'jobSubmissionRawZipExtensionInvalid'
      : slot === 'transcript_timestamps'
        ? 'jobSubmissionTranscriptTimestampsExtensionInvalid'
        : 'jobSubmissionTranscriptExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'jobSubmissionRawFileJobNumberInvalid';
  }

  if (slot === 'transcript_rtf' || slot === 'transcript_timestamps') {
    const baseName = getBaseName(trimmed);
    if (!transcriptBaseNameIsValid(jobNumber, baseName)) {
      return 'jobSubmissionTranscriptFilenameMustEndWithT';
    }
  }

  return null;
}

export function validateRawFilesBundle(
  jobNumber: string,
  bundle: JobSubmissionRawFilesBundle,
): string[] {
  const errors: string[] = [];
  const slots: Array<{ slot: JobSubmissionRawFileSlot; file: JobSubmissionFileEntry | null }> = [
    { slot: 'raw_zip', file: bundle.rawZip },
    { slot: 'transcript_timestamps', file: bundle.transcriptWithTimestamps },
    { slot: 'transcript_rtf', file: bundle.transcript },
  ];

  for (const { slot, file } of slots) {
    if (!file?.name) {
      errors.push(
        slot === 'raw_zip'
          ? 'jobSubmissionRawZipRequired'
          : slot === 'transcript_timestamps'
            ? 'jobSubmissionTranscriptTimestampsRequired'
            : 'jobSubmissionTranscriptRequired',
      );
      continue;
    }
    const nameError = validateRawFileName(jobNumber, file.name, slot);
    if (nameError) errors.push(nameError);
  }

  return [...new Set(errors)];
}

export function rawFilesBundleHasFiles(bundle: JobSubmissionRawFilesBundle): boolean {
  return Boolean(bundle.rawZip || bundle.transcriptWithTimestamps || bundle.transcript);
}

export function countRawFilesBundle(bundle: JobSubmissionRawFilesBundle): number {
  return [bundle.rawZip, bundle.transcriptWithTimestamps, bundle.transcript].filter(Boolean).length;
}

function countBillableTranscriptCharacters(text: string): number {
  let plain = text;
  if (plain.includes('{\\rtf')) {
    plain = plain
      .replace(/\\[a-z]+-?\d* ?/gi, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/\\'[0-9a-f]{2}/gi, ' ');
  }
  plain = plain
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\bSPEAKER\s*\d*:?/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '');
  return plain.length;
}

/** §2.5 — Cached text extracted during job submission for transcript report metrics. */
export function buildJobSubmissionAnalysis(rawFiles: JobSubmissionRawFilesBundle) {
  const transcriptPlainText = rawFiles.transcript?.textContent ?? '';
  const transcriptTimestampsText = rawFiles.transcriptWithTimestamps?.textContent ?? '';
  const transcriptCharacterCount = transcriptPlainText.trim()
    ? countBillableTranscriptCharacters(transcriptPlainText)
    : undefined;

  return {
    transcriptPlainText,
    transcriptTimestampsText,
    transcriptCharacterCount,
  };
}
