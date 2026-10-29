const JOB_NUMBER_PATTERN = /^JB\d{6}$/;

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

/** §2.6.3 — Validate edited transcript .zip filename for the job. */
export function validateEditedTranscriptFileName(jobNumber, fileName) {
  const trimmed = typeof fileName === 'string' ? fileName.trim() : '';
  if (!trimmed) return 'transcriptEditedTranscriptRequired';

  if (getExtension(trimmed) !== 'zip') {
    return 'transcriptEditedTranscriptExtensionInvalid';
  }

  if (!matchesJobFilenamePattern(jobNumber, trimmed)) {
    return 'transcriptEditedTranscriptFilenameInvalid';
  }

  return null;
}
