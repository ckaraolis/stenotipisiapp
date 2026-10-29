import type { JobSubmissionSameDayActions } from '../types/jobSubmission';
import type { TranslationKey } from '../i18n/translations';

export function validateJobSubmissionSameDayActions(
  actions: JobSubmissionSameDayActions,
): TranslationKey[] {
  const missingDetails =
    (actions.arrestWarrant && !actions.arrestWarrantDetails.trim()) ||
    (actions.witnessSummons && !actions.witnessSummonsDetails.trim()) ||
    (actions.defendantTerms && !actions.defendantTermsDetails.trim()) ||
    (actions.welfareReport && !actions.welfareReportDetails.trim());

  return missingDetails ? ['jobSubmissionSameDayActionDetailsRequired'] : [];
}
