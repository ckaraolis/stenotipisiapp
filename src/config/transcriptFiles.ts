import type { TranslationKey } from '../i18n/translations';
import type {
  TranscriptFileListItem,
  TranscriptFilesBundle,
  TranscriptFileSlot,
} from '../types/transcript';

const GROUP_ORDER: Record<string, number> = {
  raw: 1,
  attachment: 2,
  edited: 3,
  reviewed: 4,
  other: 5,
};

const STANDARD_SLOT_META: Record<
  Exclude<TranscriptFileSlot, 'other' | 'edited_transcript' | 'reviewed_transcript'>,
  { group: string; order: number; descriptionKey: TranslationKey }
> = {
  raw_zip: { group: 'raw', order: 1, descriptionKey: 'transcriptFileDescRawFile' },
  raw_transcript_timestamps: {
    group: 'raw',
    order: 2,
    descriptionKey: 'transcriptFileDescRawTranscriptTimestamps',
  },
  raw_transcript: { group: 'raw', order: 3, descriptionKey: 'transcriptFileDescRawTranscript' },
  attachment_personal_dictionary: {
    group: 'attachment',
    order: 1,
    descriptionKey: 'transcriptFileDescPersonalDictionary',
  },
  attachment_evidence_list: {
    group: 'attachment',
    order: 2,
    descriptionKey: 'transcriptFileDescEvidenceList',
  },
};

export function getTranscriptFileDescription(
  item: TranscriptFileListItem,
  t: (key: TranslationKey) => string,
): string {
  if (item.descriptionKey) {
    return t(item.descriptionKey as TranslationKey);
  }
  return item.description || '—';
}

export function getTranscriptFileDescriptionFilterOptions(
  files: TranscriptFileListItem[],
  t: (key: TranslationKey) => string,
): string[] {
  const options = new Set<string>();
  for (const file of files) {
    options.add(getTranscriptFileDescription(file, t));
  }
  return [...options].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function buildTranscriptFileListFromBundle(
  files: TranscriptFilesBundle,
): TranscriptFileListItem[] {
  const rows: TranscriptFileListItem[] = [];

  const raw = files.rawFiles ?? {};
  const rawSlots: Array<[TranscriptFileSlot, (typeof raw)[keyof typeof raw]]> = [
    ['raw_zip', raw.rawZip],
    ['raw_transcript_timestamps', raw.transcriptWithTimestamps],
    ['raw_transcript', raw.transcript],
  ];
  for (const [slot, file] of rawSlots) {
    if (!file?.name) continue;
    const meta = STANDARD_SLOT_META[slot as keyof typeof STANDARD_SLOT_META];
    rows.push({
      rowId: `${slot}:${file.id}`,
      slot,
      group: 'raw',
      groupOrder: GROUP_ORDER.raw,
      slotOrder: meta.order,
      descriptionKey: meta.descriptionKey,
      description: '',
      fileId: file.id,
      name: file.name,
      size: file.size,
      uploadedAt: file.uploadedAt,
      hasStorage: Boolean(file.storageId),
      historyCount: file.history?.length ?? 0,
      isStandard: true,
    });
  }

  const attachments = files.attachmentFiles ?? {};
  const attachmentSlots: Array<[TranscriptFileSlot, (typeof attachments)[keyof typeof attachments]]> =
    [
      ['attachment_personal_dictionary', attachments.personalDictionary],
      ['attachment_evidence_list', attachments.evidenceList],
    ];
  for (const [slot, file] of attachmentSlots) {
    if (!file?.name) continue;
    const meta = STANDARD_SLOT_META[slot as keyof typeof STANDARD_SLOT_META];
    rows.push({
      rowId: `${slot}:${file.id}`,
      slot,
      group: 'attachment',
      groupOrder: GROUP_ORDER.attachment,
      slotOrder: meta.order,
      descriptionKey: meta.descriptionKey,
      description: '',
      fileId: file.id,
      name: file.name,
      size: file.size,
      uploadedAt: file.uploadedAt,
      hasStorage: Boolean(file.storageId),
      historyCount: file.history?.length ?? 0,
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
      size: file.size,
      uploadedAt: file.uploadedAt,
      hasStorage: Boolean(file.storageId),
      historyCount: file.history?.length ?? 0,
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
      size: file.size,
      uploadedAt: file.uploadedAt,
      hasStorage: Boolean(file.storageId),
      historyCount: file.history?.length ?? 0,
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
      size: file.size,
      uploadedAt: file.uploadedAt,
      hasStorage: Boolean(file.storageId),
      historyCount: file.history?.length ?? 0,
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

export function formatTranscriptFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}
