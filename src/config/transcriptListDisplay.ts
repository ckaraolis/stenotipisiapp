import { TRANSCRIPT_ETE_MINUTES_PER_PAGE } from './jobMatrix';
import { formatEditDuration } from './transcriptData';
import { formatTranscriptDeadline } from './transcriptDetails';
import {
  shouldShowTranscriptDeadline,
  shouldShowTranscriptEditDuration,
  isJobStatusBefore,
} from './transcriptListPermissions';
import type { TranslationKey } from '../i18n/translations';
import type { TranscriptRecord } from '../types/transcript';

export type TranscriptListSortKey =
  | 'jobNumber'
  | 'date'
  | 'jobStatus'
  | 'customerName'
  | 'projectNumber'
  | 'stenotypistName'
  | 'editorName'
  | 'reviewerName'
  | 'publisherName'
  | 'eteMinutes'
  | 'deadlineMinutes';

export type TranscriptListSortDirection = 'asc' | 'desc';

export interface TranscriptListDefaults {
  dateFrom: string;
  dateTo: string;
  jobStatus: string;
}

export function getDefaultTranscriptDateRange(
  transcripts: Array<{ date: string; jobStatus: string }>,
): { dateFrom: string; dateTo: string } {
  const notEdited = transcripts.filter((row) => isJobStatusBefore(row.jobStatus, 'edited'));
  const notPublished = transcripts.filter((row) => row.jobStatus !== 'published');
  const fromDates = notEdited.map((row) => row.date).filter(Boolean).sort();
  const toDates = notPublished.map((row) => row.date).filter(Boolean).sort();

  if (fromDates.length === 0 || toDates.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { dateFrom: today, dateTo: today };
  }

  return { dateFrom: fromDates[0], dateTo: toDates[toDates.length - 1] };
}

export function formatTranscriptEte(pageCount: number): string {
  const minutes = pageCount * TRANSCRIPT_ETE_MINUTES_PER_PAGE;
  return minutes.toFixed(1);
}

export function formatTranscriptListDeadline(
  transcript: TranscriptRecord,
  t: (key: TranslationKey) => string,
): string {
  if (!shouldShowTranscriptDeadline(transcript.jobStatus)) return '';
  return formatTranscriptDeadline(transcript.deadlineMinutes, t);
}

export function formatTranscriptListEditDuration(transcript: TranscriptRecord): string {
  if (!shouldShowTranscriptEditDuration(transcript.jobStatus)) return '';
  return formatEditDuration(transcript.editDurationMinutes);
}

export function formatTranscriptOwnerLabels(labels: string[]): string {
  if (!labels.length) return '—';
  return labels.join(', ');
}

export {
  canUseTranscriptCustomerFilter,
  canUseTranscriptStenotypistFilter,
  getTranscriptListSubtitleKey,
} from './transcriptList';

export {
  canUseTranscriptEditorFilter,
  canUseTranscriptOwnerFilter,
  canUseTranscriptReviewerFilter,
  getTranscriptDownloadTarget,
  getTranscriptListInlineActions,
  type TranscriptListInlineAction,
} from './transcriptListPermissions';
