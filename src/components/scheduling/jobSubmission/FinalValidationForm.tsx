import {
  countAttachmentFilesBundle,
} from '../../../config/jobSubmissionAttachmentFiles';
import {
  countRawFilesBundle,
} from '../../../config/jobSubmissionRawFiles';
import type { JobSubmissionRecord } from '../../../types/jobSubmission';
import type { JobRecord } from '../../../types/jobRecord';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TranslationKey } from '../../../i18n/translations';
import { formatDateDisplay } from '../../../utils/dateFormat';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface FinalValidationFormProps {
  job: JobRecord;
  submission: JobSubmissionRecord;
}

type SameDayActionKey =
  | 'arrestWarrant'
  | 'witnessSummons'
  | 'defendantTerms'
  | 'welfareReport';

const SAME_DAY_ACTIONS: Array<{
  checkboxKey: SameDayActionKey;
  detailsKey: `${SameDayActionKey}Details`;
  labelKey: TranslationKey;
}> = [
  {
    checkboxKey: 'arrestWarrant',
    detailsKey: 'arrestWarrantDetails',
    labelKey: 'sameDayActionArrestWarrant',
  },
  {
    checkboxKey: 'witnessSummons',
    detailsKey: 'witnessSummonsDetails',
    labelKey: 'sameDayActionWitnessSummons',
  },
  {
    checkboxKey: 'defendantTerms',
    detailsKey: 'defendantTermsDetails',
    labelKey: 'sameDayActionDefendantTerms',
  },
  {
    checkboxKey: 'welfareReport',
    detailsKey: 'welfareReportDetails',
    labelKey: 'sameDayActionWelfareReport',
  },
];

function SummaryValue({ value }: { value: string }) {
  return <span className="workflow-wizard-summary-value">{value || '—'}</span>;
}

export default function FinalValidationForm({ job, submission }: FinalValidationFormProps) {
  const { t } = useLanguage();
  const selectedSameDayActions = SAME_DAY_ACTIONS.filter(
    ({ checkboxKey }) => submission.sameDayActions[checkboxKey],
  );

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepFinalValidation')}</h3>
      <p className="workflow-wizard-step-description">
        {t('jobSubmissionStepFinalValidationDescription')}
      </p>

      <div className="workflow-wizard-summary-grid">
        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionStepRawFiles')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('jobSubmissionRawFilesUpload')}</dt>
              <dd>
                <SummaryValue value={submission.rawFiles.rawZip?.name ?? ''} />
              </dd>
            </div>
            <div>
              <dt>{t('jobSubmissionTranscriptTimestampsUpload')}</dt>
              <dd>
                <SummaryValue value={submission.rawFiles.transcriptWithTimestamps?.name ?? ''} />
              </dd>
            </div>
            <div>
              <dt>{t('jobSubmissionTranscriptUpload')}</dt>
              <dd>
                <SummaryValue value={submission.rawFiles.transcript?.name ?? ''} />
              </dd>
            </div>
          </dl>
          <p className="workflow-wizard-summary-meta">
            {countRawFilesBundle(submission.rawFiles)} / 3 {t('files')}
          </p>
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionStepAttachmentFiles')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('jobSubmissionPersonalDictionaryUpload')}</dt>
              <dd>
                <SummaryValue value={submission.attachmentFiles.personalDictionary?.name ?? ''} />
              </dd>
            </div>
            <div>
              <dt>{t('jobSubmissionEvidenceListUpload')}</dt>
              <dd>
                <SummaryValue value={submission.attachmentFiles.evidenceList?.name ?? ''} />
              </dd>
            </div>
          </dl>
          <p className="workflow-wizard-summary-meta">
            {countAttachmentFilesBundle(submission.attachmentFiles)} / 2 {t('files')}
          </p>
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionStepOtherFiles')}</h4>
          {submission.otherFiles.length === 0 ? (
            <p className="workflow-wizard-summary-meta">{t('noFilesSelected')}</p>
          ) : (
            <dl className="workflow-wizard-summary-detail-list">
              {submission.otherFiles.map((file) => (
                <div key={file.id}>
                  <dt>{file.name}</dt>
                  <dd>
                    <SummaryValue value={file.description} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionStepSameDayActions')}</h4>
          {selectedSameDayActions.length === 0 &&
          !submission.sameDayActions.otherDetails.trim() ? (
            <p className="workflow-wizard-summary-meta">—</p>
          ) : (
            <dl className="workflow-wizard-summary-detail-list">
              {selectedSameDayActions.map(({ checkboxKey, detailsKey, labelKey }) => (
                <div key={checkboxKey}>
                  <dt>{t(labelKey)}</dt>
                  <dd>
                    <SummaryValue value={submission.sameDayActions[detailsKey]} />
                  </dd>
                </div>
              ))}
              {submission.sameDayActions.otherDetails.trim() ? (
                <div>
                  <dt>{t('sameDayActionOther')}</dt>
                  <dd>
                    <SummaryValue value={submission.sameDayActions.otherDetails} />
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionStepJobReceipt')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('receiptNumberStenotypist')}</dt>
              <dd>
                <SummaryValue value={submission.receipt.receiptNumberStenotypist} />
              </dd>
            </div>
            <div>
              <dt>{t('startTimeStenotypist')}</dt>
              <dd>
                <SummaryValue value={submission.receipt.startTimeStenotypist} />
              </dd>
            </div>
            <div>
              <dt>{t('endTimeStenotypist')}</dt>
              <dd>
                <SummaryValue value={submission.receipt.endTimeStenotypist} />
              </dd>
            </div>
          </dl>
        </section>

        <section className="workflow-wizard-summary-card">
          <h4>{t('jobSubmissionSummaryJobDetails')}</h4>
          <dl className="workflow-wizard-summary-detail-list">
            <div>
              <dt>{t('jobNumber')}</dt>
              <dd>
                <SummaryValue value={job.jobNumber} />
              </dd>
            </div>
            <div>
              <dt>{t('customer')}</dt>
              <dd>
                <SummaryValue value={job.customerName} />
              </dd>
            </div>
            <div>
              <dt>{t('project')}</dt>
              <dd>
                <SummaryValue value={job.projectNumber} />
              </dd>
            </div>
            <div>
              <dt>{t('date')}</dt>
              <dd>
                <SummaryValue value={formatDateDisplay(job.date)} />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
