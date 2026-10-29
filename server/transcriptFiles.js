import crypto from 'node:crypto';
import { findUserById } from './db.js';
import { canAccessTranscriptRecord, canEditTranscriptDetails } from './transcriptAccess.js';
import {
  decodeUploadContent,
  createStorageId,
  readTranscriptFileBinaryAsync,
  storeTranscriptFileBinary,
} from './transcriptFileStorage.js';
import {
  findTranscriptRowById,
  readTranscriptRows,
  toPublicTranscript,
  writeTranscriptRows,
} from './transcripts.js';

const GROUP_ORDER = {
  raw: 1,
  attachment: 2,
  edited: 3,
  reviewed: 4,
  other: 5,
};

const STANDARD_SLOTS = {
  raw_zip: {
    group: 'raw',
    order: 1,
    descriptionKey: 'transcriptFileDescRawFile',
    path: ['rawFiles', 'rawZip'],
  },
  raw_transcript_timestamps: {
    group: 'raw',
    order: 2,
    descriptionKey: 'transcriptFileDescRawTranscriptTimestamps',
    path: ['rawFiles', 'transcriptWithTimestamps'],
  },
  raw_transcript: {
    group: 'raw',
    order: 3,
    descriptionKey: 'transcriptFileDescRawTranscript',
    path: ['rawFiles', 'transcript'],
  },
  attachment_personal_dictionary: {
    group: 'attachment',
    order: 1,
    descriptionKey: 'transcriptFileDescPersonalDictionary',
    path: ['attachmentFiles', 'personalDictionary'],
  },
  attachment_evidence_list: {
    group: 'attachment',
    order: 2,
    descriptionKey: 'transcriptFileDescEvidenceList',
    path: ['attachmentFiles', 'evidenceList'],
  },
};

function canManageStandardTranscriptFiles(actor) {
  return canEditTranscriptDetails(actor);
}

function canManageOtherTranscriptFiles(actor, transcript) {
  if (canEditTranscriptDetails(actor)) {
    return true;
  }
  const actorId = actor?.id ?? '';
  if (!actorId || !transcript) {
    return false;
  }
  return (
    transcript.stenotypistUserId === actorId || transcript.editorUserId === actorId
  );
}

function toVersionSnapshot(file, actor) {
  if (!file?.name) return null;
  return {
    id: file.id || `ver-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    size: file.size ?? 0,
    type: file.type ?? '',
    uploadedAt: file.uploadedAt || new Date().toISOString(),
    uploadedByUserId: actor?.id ?? null,
    description: file.description ?? '',
    storageId: file.storageId ?? '',
  };
}

function createFileEntryFromUpload(input, actor, previous = null) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { errors: ['transcriptFileNameRequired'] };

  const buffer = decodeUploadContent(input.contentBase64);
  if (!buffer || buffer.length === 0) {
    return { errors: ['transcriptFileContentRequired'] };
  }

  const storageId = createStorageId();
  const entry = {
    id: previous?.id || `file-${crypto.randomUUID().slice(0, 8)}`,
    name,
    size: buffer.length,
    type: typeof input.type === 'string' ? input.type.trim() : 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    description:
      typeof input.description === 'string'
        ? input.description.trim()
        : (previous?.description ?? ''),
    storageId,
    history: Array.isArray(previous?.history) ? [...previous.history] : [],
  };

  if (previous?.name) {
    const snapshot = toVersionSnapshot(previous, actor);
    if (snapshot) {
      entry.history.push(snapshot);
    }
  }

  return { entry, buffer };
}

function getNestedValue(files, pathKeys) {
  let current = files;
  for (const key of pathKeys) {
    if (!current || typeof current !== 'object') return null;
    current = current[key];
  }
  return current ?? null;
}

function setNestedValue(files, pathKeys, value) {
  let current = files;
  for (let index = 0; index < pathKeys.length - 1; index += 1) {
    const key = pathKeys[index];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[pathKeys[pathKeys.length - 1]] = value;
}

export function buildTranscriptFileListItems(files = {}) {
  const rows = [];

  for (const [slot, config] of Object.entries(STANDARD_SLOTS)) {
    const file = getNestedValue(files, config.path);
    if (!file?.name) continue;
    rows.push({
      rowId: `${slot}:${file.id}`,
      slot,
      group: config.group,
      groupOrder: GROUP_ORDER[config.group],
      slotOrder: config.order,
      descriptionKey: config.descriptionKey,
      description: '',
      fileId: file.id,
      name: file.name,
      size: file.size ?? 0,
      uploadedAt: file.uploadedAt ?? '',
      hasStorage: Boolean(file.storageId),
      historyCount: Array.isArray(file.history) ? file.history.length : 0,
      isStandard: true,
    });
  }

  for (const file of files.editedRawFiles ?? []) {
    if (!file?.name) continue;
    rows.push({
      rowId: `edited_transcript:${file.id}`,
      slot: 'edited_transcript',
      group: 'edited',
      groupOrder: GROUP_ORDER.edited,
      slotOrder: 1,
      descriptionKey: 'transcriptFileDescEditedTranscript',
      description: '',
      fileId: file.id,
      name: file.name,
      size: file.size ?? 0,
      uploadedAt: file.uploadedAt ?? '',
      hasStorage: Boolean(file.storageId),
      historyCount: Array.isArray(file.history) ? file.history.length : 0,
      isStandard: true,
    });
  }

  for (const file of files.reviewedRawFiles ?? []) {
    if (!file?.name) continue;
    rows.push({
      rowId: `reviewed_transcript:${file.id}`,
      slot: 'reviewed_transcript',
      group: 'reviewed',
      groupOrder: GROUP_ORDER.reviewed,
      slotOrder: 1,
      descriptionKey: 'transcriptFileDescReviewedTranscript',
      description: '',
      fileId: file.id,
      name: file.name,
      size: file.size ?? 0,
      uploadedAt: file.uploadedAt ?? '',
      hasStorage: Boolean(file.storageId),
      historyCount: Array.isArray(file.history) ? file.history.length : 0,
      isStandard: true,
    });
  }

  for (const file of files.otherFiles ?? []) {
    if (!file?.name) continue;
    rows.push({
      rowId: `other:${file.id}`,
      slot: 'other',
      group: 'other',
      groupOrder: GROUP_ORDER.other,
      slotOrder: 0,
      descriptionKey: '',
      description: file.description ?? '',
      fileId: file.id,
      name: file.name,
      size: file.size ?? 0,
      uploadedAt: file.uploadedAt ?? '',
      hasStorage: Boolean(file.storageId),
      historyCount: Array.isArray(file.history) ? file.history.length : 0,
      isStandard: false,
    });
  }

  return rows.sort(
    (a, b) =>
      a.groupOrder - b.groupOrder ||
      a.slotOrder - b.slotOrder ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

function findFileInBundle(files, slot, fileId) {
  if (STANDARD_SLOTS[slot]) {
    return getNestedValue(files, STANDARD_SLOTS[slot].path);
  }
  if (slot === 'edited_transcript') {
    return (files.editedRawFiles ?? []).find((row) => row.id === fileId) ?? null;
  }
  if (slot === 'reviewed_transcript') {
    return (files.reviewedRawFiles ?? []).find((row) => row.id === fileId) ?? null;
  }
  if (slot === 'other') {
    return (files.otherFiles ?? []).find((row) => row.id === fileId) ?? null;
  }
  if (slot === 'approved_transcript') {
    const approved = files.approvedTranscriptFile;
    return approved?.id === fileId || !fileId ? approved : null;
  }
  return null;
}

function replaceFileInBundle(files, slot, fileId, entry) {
  if (STANDARD_SLOTS[slot]) {
    setNestedValue(files, STANDARD_SLOTS[slot].path, entry);
    return;
  }
  if (slot === 'edited_transcript') {
    const list = files.editedRawFiles ?? [];
    const index = list.findIndex((row) => row.id === fileId);
    if (index >= 0) {
      list[index] = entry;
    } else {
      list.push(entry);
    }
    files.editedRawFiles = list;
    return;
  }
  if (slot === 'reviewed_transcript') {
    const list = files.reviewedRawFiles ?? [];
    const index = list.findIndex((row) => row.id === fileId);
    if (index >= 0) {
      list[index] = entry;
    } else {
      list.push(entry);
    }
    files.reviewedRawFiles = list;
    return;
  }
  if (slot === 'other') {
    const list = files.otherFiles ?? [];
    const index = list.findIndex((row) => row.id === fileId);
    if (index >= 0) {
      list[index] = entry;
    } else {
      list.push(entry);
    }
    files.otherFiles = list;
  }
}

export function getTranscriptFilesList(transcriptId, actor) {
  const rows = readTranscriptRows();
  const transcript = findTranscriptRowById(transcriptId, rows);
  if (!transcript) {
    return { errors: ['transcriptNotFound'] };
  }
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }
  return {
    transcript: toPublicTranscript(transcript, rows),
    files: buildTranscriptFileListItems(transcript.files),
    canManageStandard: canManageStandardTranscriptFiles(actor),
    canManageOther: canManageOtherTranscriptFiles(actor, transcript),
  };
}

export function addTranscriptOtherFile(transcriptId, input, actor) {
  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) {
    return { errors: ['transcriptNotFound'] };
  }

  const transcript = rows[index];
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }
  if (!canManageOtherTranscriptFiles(actor, transcript)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const description =
    typeof input.description === 'string' ? input.description.trim().slice(0, 500) : '';
  if (!description) {
    return { errors: ['transcriptFileDescriptionRequired'] };
  }

  const upload = createFileEntryFromUpload({ ...input, description }, actor);
  if (upload.errors) return upload;

  storeTranscriptFileBinary(transcriptId, upload.entry.storageId, upload.buffer);

  const files = { ...transcript.files, otherFiles: [...(transcript.files?.otherFiles ?? [])] };
  files.otherFiles.push(upload.entry);

  const next = {
    ...transcript,
    files,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = next;
  writeTranscriptRows(rows);

  return {
    transcript: toPublicTranscript(next, rows),
    messages: ['transcriptFileAddedSuccess'],
  };
}

export function updateTranscriptFile(transcriptId, input, actor) {
  const slot = typeof input.slot === 'string' ? input.slot.trim() : '';
  const fileId = typeof input.fileId === 'string' ? input.fileId.trim() : '';
  if (!slot) {
    return { errors: ['transcriptFileSlotRequired'] };
  }

  const rows = readTranscriptRows();
  const index = rows.findIndex((row) => row.id === transcriptId);
  if (index === -1) {
    return { errors: ['transcriptNotFound'] };
  }

  const transcript = rows[index];
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const isOtherFile = slot === 'other';
  if (isOtherFile) {
    if (!canManageOtherTranscriptFiles(actor, transcript)) {
      return { errors: ['transcriptAccessDenied'] };
    }
  } else if (!canManageStandardTranscriptFiles(actor)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const files = JSON.parse(JSON.stringify(transcript.files ?? {}));
  const existing = findFileInBundle(files, slot, fileId);
  if (!existing) {
    return { errors: ['transcriptFileNotFound'] };
  }

  const hasUpload = typeof input.contentBase64 === 'string' && input.contentBase64.trim();
  const description =
    typeof input.description === 'string' ? input.description.trim().slice(0, 500) : existing.description;

  if (slot === 'other' && !description) {
    return { errors: ['transcriptFileDescriptionRequired'] };
  }

  let nextEntry = { ...existing };

  if (hasUpload) {
    const upload = createFileEntryFromUpload(
      {
        name: typeof input.name === 'string' ? input.name : existing.name,
        type: typeof input.type === 'string' ? input.type : existing.type,
        contentBase64: input.contentBase64,
        description: slot === 'other' ? description : existing.description,
      },
      actor,
      existing,
    );
    if (upload.errors) return upload;
    storeTranscriptFileBinary(transcriptId, upload.entry.storageId, upload.buffer);
    nextEntry = upload.entry;
  } else if (slot === 'other') {
    nextEntry = { ...existing, description };
  } else {
    return { errors: ['transcriptFileContentRequired'] };
  }

  replaceFileInBundle(files, slot, fileId, nextEntry);

  const next = {
    ...transcript,
    files,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = next;
  writeTranscriptRows(rows);

  return {
    transcript: toPublicTranscript(next, rows),
    messages: ['transcriptFileUpdatedSuccess'],
  };
}

export async function getTranscriptFileDownload(transcriptId, slot, fileId, actor) {
  const rows = readTranscriptRows();
  const transcript = findTranscriptRowById(transcriptId, rows);
  if (!transcript) {
    return { errors: ['transcriptNotFound'] };
  }
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const file = findFileInBundle(transcript.files ?? {}, slot, fileId);
  if (!file?.name) {
    return { errors: ['transcriptFileNotFound'] };
  }
  if (!file.storageId) {
    return { errors: ['transcriptFileBinaryUnavailable'] };
  }

  const buffer = await readTranscriptFileBinaryAsync(transcriptId, file.storageId);
  if (!buffer) {
    return { errors: ['transcriptFileBinaryUnavailable'] };
  }

  return {
    buffer,
    name: file.name,
    type: file.type || 'application/octet-stream',
  };
}

export function getTranscriptFileHistory(transcriptId, slot, fileId, actor) {
  const rows = readTranscriptRows();
  const transcript = findTranscriptRowById(transcriptId, rows);
  if (!transcript) {
    return { errors: ['transcriptNotFound'] };
  }
  if (!canAccessTranscriptRecord(actor, transcript, rows)) {
    return { errors: ['transcriptAccessDenied'] };
  }

  const file = findFileInBundle(transcript.files ?? {}, slot, fileId);
  if (!file) {
    return { errors: ['transcriptFileNotFound'] };
  }

  const history = Array.isArray(file.history) ? file.history : [];
  return {
    history: history.map((entry) => {
      const user = entry.uploadedByUserId ? findUserById(entry.uploadedByUserId) : null;
      return {
        id: entry.id,
        name: entry.name,
        size: entry.size ?? 0,
        type: entry.type ?? '',
        uploadedAt: entry.uploadedAt ?? '',
        uploadedByName: user?.fullName || user?.username || '',
        description: entry.description ?? '',
        hasStorage: Boolean(entry.storageId),
      };
    }),
  };
}
