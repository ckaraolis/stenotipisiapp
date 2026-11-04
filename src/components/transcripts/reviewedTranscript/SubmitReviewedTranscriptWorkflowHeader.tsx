import type { TranscriptRecord } from '../../../types/transcript';
import { useLanguage } from '../../../i18n/LanguageContext';
import { formatDateDisplay } from '../../../utils/dateFormat';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface SubmitReviewedTranscriptWorkflowHeaderProps {
  transcript: TranscriptRecord;
  reviewerName: string;
}

export default function SubmitReviewedTranscriptWorkflowHeader({
  transcript,
  reviewerName,
}: SubmitReviewedTranscriptWorkflowHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="workflow-wizard-job-header">
      <div className="profile-grid">
        <label className="profile-label" htmlFor="reviewed-workflow-job-number">
          {t('jobNumber')}
        </label>
        <input
          id="reviewed-workflow-job-number"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.jobNumber}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-customer">
          {t('customer')}
        </label>
        <input
          id="reviewed-workflow-customer"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.customerName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-project">
          {t('project')}
        </label>
        <input
          id="reviewed-workflow-project"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.projectNumber || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-date">
          {t('date')}
        </label>
        <input
          id="reviewed-workflow-date"
          type="text"
          className="profile-input profile-input-readonly"
          value={formatDateDisplay(transcript.date)}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-stenotypist">
          {t('stenotypist')}
        </label>
        <input
          id="reviewed-workflow-stenotypist"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.stenotypistAlias || transcript.stenotypistName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-edited-by">
          {t('editedBy')}
        </label>
        <input
          id="reviewed-workflow-edited-by"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.editorName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="reviewed-workflow-reviewer">
          {t('reviewer')}
        </label>
        <input
          id="reviewed-workflow-reviewer"
          type="text"
          className="profile-input profile-input-readonly"
          value={reviewerName || '—'}
          readOnly
        />
      </div>
    </div>
  );
}
