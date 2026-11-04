import type { TranscriptRecord } from '../../../types/transcript';
import { useLanguage } from '../../../i18n/LanguageContext';
import { formatDateDisplay } from '../../../utils/dateFormat';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface EditedTranscriptFinalValidationFormProps {
  transcript: TranscriptRecord;
  editorName: string;
  fileName: string;
  remarks: string;
}

function SummaryValue({ value }: { value: string }) {
  return <span className="workflow-wizard-summary-value">{value || '—'}</span>;
}

export default function EditedTranscriptFinalValidationForm({
  transcript,
  editorName,
  fileName,
  remarks,
}: EditedTranscriptFinalValidationFormProps) {
  const { t } = useLanguage();

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('transcriptEditedStepFinalValidation')}</h3>
      <p className="workflow-wizard-step-description">
        {t('transcriptEditedStepFinalValidationDescription')}
      </p>

      <div className="workflow-wizard-summary-grid">
        <section className="workflow-wizard-summary-card">
          <h4>{t('transcriptEditedStepUpload')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('transcriptEditedTranscriptUpload')}</dt>
              <dd>
                <SummaryValue value={fileName} />
              </dd>
            </div>
            <div>
              <dt>{t('editorRemarks')}</dt>
              <dd>
                <SummaryValue value={remarks} />
              </dd>
            </div>
          </dl>
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('transcriptEditedSummaryJobDetails')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('jobNumber')}</dt>
              <dd>
                <SummaryValue value={transcript.jobNumber} />
              </dd>
            </div>
            <div>
              <dt>{t('customer')}</dt>
              <dd>
                <SummaryValue value={transcript.customerName} />
              </dd>
            </div>
            <div>
              <dt>{t('project')}</dt>
              <dd>
                <SummaryValue value={transcript.projectNumber} />
              </dd>
            </div>
            <div>
              <dt>{t('date')}</dt>
              <dd>
                <SummaryValue value={formatDateDisplay(transcript.date)} />
              </dd>
            </div>
            <div>
              <dt>{t('stenotypist')}</dt>
              <dd>
                <SummaryValue value={transcript.stenotypistAlias || transcript.stenotypistName} />
              </dd>
            </div>
            <div>
              <dt>{t('editor')}</dt>
              <dd>
                <SummaryValue value={editorName} />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
