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

export function emptyAttachmentFilesBundle() {
  return {
    personalDictionary: null,
    evidenceList: null,
  };
}

export function expectedExtensionsForAttachmentFileSlot(slot) {
  return slot === 'personal_dictionary' ? ['rtf'] : ['doc', 'docx'];
}

function matchesJobFilenamePattern(jobNumber, fileName) {
  if (!JOB_NUMBER_PATTERN.test(jobNumber)) return false;
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_\\d{6}\\.[^.]+$`, 'i');
  return pattern.test(fileName);
}

function personalDictionaryBaseNameIsValid(jobNumber, baseName) {
  const pattern = new RegExp(`^${escapeRegex(jobNumber)}_.+_D_\\d{6}$`, 'i');
  return pattern.test(baseName);
}

export function validateAttachmentFileName(jobNumber, fileName, slot) {
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

export function validateAttachmentFilesBundle(jobNumber, bundle) {
  const errors = [];
  const slots = [
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

export function normalizeAttachmentFiles(value) {
  const empty = emptyAttachmentFilesBundle();
  if (!value || typeof value !== 'object') return empty;
  if (Array.isArray(value)) return empty;
  return {
    personalDictionary: normalizeSingleFile(value.personalDictionary),
    evidenceList: normalizeSingleFile(value.evidenceList),
  };
}
