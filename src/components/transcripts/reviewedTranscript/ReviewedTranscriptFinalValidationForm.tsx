import type { TranscriptRecord } from '../../../types/transcript';
import { useLanguage } from '../../../i18n/LanguageContext';
import { formatDateDisplay } from '../../../utils/dateFormat';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface ReviewedTranscriptFinalValidationFormProps {
  transcript: TranscriptRecord;
  reviewerName: string;
  fileName: string;
  remarks: string;
  bypassApproval: boolean;
}

function SummaryValue({ value }: { value: string }) {
  return <span className="workflow-wizard-summary-value">{value || '—'}</span>;
}

export default function ReviewedTranscriptFinalValidationForm({
  transcript,
  reviewerName,
  fileName,
  remarks,
  bypassApproval,
}: ReviewedTranscriptFinalValidationFormProps) {
  const { t } = useLanguage();

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('transcriptReviewedStepFinalValidation')}</h3>
      <p className="workflow-wizard-step-description">
        {t('transcriptReviewedStepFinalValidationDescription')}
      </p>

      <div className="workflow-wizard-summary-grid">
        <section className="workflow-wizard-summary-card">
          <h4>{t('transcriptReviewedStepUpload')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('transcriptReviewedTranscriptUpload')}</dt>
              <dd>
                <SummaryValue value={fileName} />
              </dd>
            </div>
            <div>
              <dt>{t('reviewRemarks')}</dt>
              <dd>
                <SummaryValue value={remarks} />
              </dd>
            </div>
            {bypassApproval ? (
              <div>
                <dt>{t('bypassApproval')}</dt>
                <dd>
                  <SummaryValue value={t('yes')} />
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('transcriptReviewedSummaryJobDetails')}</h4>
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
              <dt>{t('editedBy')}</dt>
              <dd>
                <SummaryValue value={transcript.editorName} />
              </dd>
            </div>
            <div>
              <dt>{t('reviewer')}</dt>
              <dd>
                <SummaryValue value={reviewerName} />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
