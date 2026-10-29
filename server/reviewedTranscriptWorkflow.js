const JOB_NUMBER_PATTERN = /^JB\d{6}$/;
const REVIEWED_EXTENSIONS = new Set(['doc', 'docx']);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExtension(fileName) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function matchesJobFilenamePattern(jobNumber, fileName) {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

/** §2.7.3 — Validate reviewed transcript .doc/.docx filename for the job. */
export function validateReviewedTranscriptFileName(jobNumber, fileName) {
  const trimmed = typeof fileName === 'string' ? fileName.trim() : '';
  if (!trimmed) return 'transcriptReviewedTranscriptRequired';

  if (!REVIEWED_EXTENSIONS.has(getExtension(trimmed))) {
    return 'transcriptReviewedTranscriptExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'transcriptReviewedTranscriptFilenameInvalid';
  }

  return null;
}
