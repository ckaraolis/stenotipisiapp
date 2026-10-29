import type { TranscriptRecord } from '../../../types/transcript';
import { useLanguage } from '../../../i18n/LanguageContext';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface SubmitEditedTranscriptWorkflowHeaderProps {
  transcript: TranscriptRecord;
  editorName: string;
}

export default function SubmitEditedTranscriptWorkflowHeader({
  transcript,
  editorName,
}: SubmitEditedTranscriptWorkflowHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="workflow-wizard-job-header">
      <div className="profile-grid">
        <label className="profile-label" htmlFor="edited-workflow-job-number">
          {t('jobNumber')}
        </label>
        <input
          id="edited-workflow-job-number"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.jobNumber}
          readOnly
        />

        <label className="profile-label" htmlFor="edited-workflow-customer">
          {t('customer')}
        </label>
        <input
          id="edited-workflow-customer"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.customerName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="edited-workflow-project">
          {t('project')}
        </label>
        <input
          id="edited-workflow-project"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.projectNumber || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="edited-workflow-date">
          {t('date')}
        </label>
        <input
          id="edited-workflow-date"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.date}
          readOnly
        />

        <label className="profile-label" htmlFor="edited-workflow-stenotypist">
          {t('stenotypist')}
        </label>
        <input
          id="edited-workflow-stenotypist"
          type="text"
          className="profile-input profile-input-readonly"
          value={transcript.stenotypistAlias || transcript.stenotypistName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="edited-workflow-editor">
          {t('editor')}
        </label>
        <input
          id="edited-workflow-editor"
          type="text"
          className="profile-input profile-input-readonly"
          value={editorName || '—'}
          readOnly
        />
      </div>
    </div>
  );
}
