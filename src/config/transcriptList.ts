import type { TranslationKey } from '../i18n/translations';
import type { TranscriptViewScope } from '../types/transcript';

export interface TranscriptListDefaults {
  dateFrom: string;
  dateTo: string;
  jobStatus: string;
}

export function getTranscriptListDefaults(): TranscriptListDefaults {
  const today = new Date().toISOString().slice(0, 10);
  return {
    dateFrom: today,
    dateTo: today,
    jobStatus: '',
  };
}

export function getTranscriptListSubtitleKey(
  viewScope: TranscriptViewScope,
): TranslationKey {
  switch (viewScope) {
    case 'own':
      return 'transcriptsListOwnSubtitle';
    case 'assigned':
      return 'transcriptsListAssignedSubtitle';
    case 'customer':
      return 'transcriptsListCustomerSubtitle';
    case 'all':
      return 'transcriptsListAllSubtitle';
    default:
      return 'transcriptsStenoSubtitle';
  }
}

export function canUseTranscriptStenotypistFilter(viewScope: TranscriptViewScope): boolean {
  return viewScope === 'all' || viewScope === 'customer';
}

export function canUseTranscriptCustomerFilter(viewScope: TranscriptViewScope): boolean {
  return viewScope === 'all' || viewScope === 'customer';
}

export {
  canUseTranscriptEditorFilter,
  canUseTranscriptOwnerFilter,
  canUseTranscriptReviewerFilter,
} from './transcriptListPermissions';
