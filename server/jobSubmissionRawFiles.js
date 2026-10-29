import crypto from 'node:crypto';

const JOB_NUMBER_PATTERN = /^JB\d{6}$/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getExtension(fileName) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function getBaseName(fileName) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(0, index) : fileName;
}

export function emptyRawFilesBundle() {
  return {
    rawZip: null,
    transcriptWithTimestamps: null,
    transcript: null,
  };
}

export function expectedExtensionForRawFileSlot(slot) {
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

function matchesJobFilenamePattern(jobNumber, fileName) {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

function transcriptBaseNameIsValid(jobNumber, baseName) {
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_T_\\d{6}$`, 'i');
  return pattern.test(baseName);
}

export function validateRawFileName(jobNumber, fileName, slot) {
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

export function validateRawFilesBundle(jobNumber, bundle) {
  const errors = [];
  const slots = [
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

function normalizeSingleFile(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string' || !entry.name.trim()) {
    return null;
  }
  return {
    id: typeof entry.id === 'string' ? entry.id.trim() : `file-${crypto.randomUUID().slice(0, 8)}`,
    name: entry.name.trim(),
    size: Number.isFinite(entry.size) ? Number(entry.size) : 0,
    type: typeof entry.type === 'string' ? entry.type.trim() : '',
    uploadedAt: typeof entry.uploadedAt === 'string' ? entry.uploadedAt : new Date().toISOString(),
  };
}

export function normalizeRawFiles(value) {
  const empty = emptyRawFilesBundle();
  if (!value || typeof value !== 'object') return empty;
  if (Array.isArray(value)) return empty;
  return {
    rawZip: normalizeSingleFile(value.rawZip),
    transcriptWithTimestamps: normalizeSingleFile(value.transcriptWithTimestamps),
    transcript: normalizeSingleFile(value.transcript),
  };
}
