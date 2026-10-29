import type { JobSubmissionSameDayActions } from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface SameDayActionsFormProps {
  sameDayActions: JobSubmissionSameDayActions;
  onChange: (sameDayActions: JobSubmissionSameDayActions) => void;
  error?: string;
  onError: (message: string) => void;
}

type ActionConfig = {
  checkboxKey: 'arrestWarrant' | 'witnessSummons' | 'defendantTerms' | 'welfareReport';
  detailsKey:
    | 'arrestWarrantDetails'
    | 'witnessSummonsDetails'
    | 'defendantTermsDetails'
    | 'welfareReportDetails';
  labelKey:
    | 'sameDayActionArrestWarrant'
    | 'sameDayActionWitnessSummons'
    | 'sameDayActionDefendantTerms'
    | 'sameDayActionWelfareReport';
};

const ACTIONS: ActionConfig[] = [
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

export default function SameDayActionsForm({
  sameDayActions,
  onChange,
  error,
  onError,
}: SameDayActionsFormProps) {
  const { t } = useLanguage();

  const updateCheckbox = (
    key: 'arrestWarrant' | 'witnessSummons' | 'defendantTerms' | 'welfareReport',
    checked: boolean,
  ) => {
    onError('');
    onChange({
      ...sameDayActions,
      [key]: checked,
    });
  };

  const updateDetails = (
    key:
      | 'arrestWarrantDetails'
      | 'witnessSummonsDetails'
      | 'defendantTermsDetails'
      | 'welfareReportDetails'
      | 'otherDetails',
    value: string,
  ) => {
    onError('');
    onChange({
      ...sameDayActions,
      [key]: value,
    });
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepSameDayActions')}</h3>
      <p className="workflow-wizard-step-description">{t('jobSubmissionStepSameDayActionsDescription')}</p>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}

      <div className="profile-grid">
        {ACTIONS.map(({ checkboxKey, detailsKey, labelKey }) => (
          <div key={checkboxKey} style={{ display: 'contents' }}>
            <label className="profile-label" htmlFor={`same-day-${checkboxKey}`}>
              {t(labelKey)}
            </label>
            <input
              id={`same-day-${checkboxKey}`}
              type="checkbox"
              checked={sameDayActions[checkboxKey]}
              onChange={(event) => updateCheckbox(checkboxKey, event.target.checked)}
            />

            <label className="profile-label" htmlFor={`same-day-${detailsKey}`}>
              {t(labelKey)}
            </label>
            <textarea
              id={`same-day-${detailsKey}`}
              className="profile-input profile-textarea"
              rows={3}
              value={sameDayActions[detailsKey]}
              disabled={!sameDayActions[checkboxKey]}
              onChange={(event) => updateDetails(detailsKey, event.target.value)}
            />
          </div>
        ))}

        <label className="profile-label" htmlFor="same-day-other-details">
          {t('sameDayActionOther')}
        </label>
        <textarea
          id="same-day-other-details"
          className="profile-input profile-textarea"
          rows={3}
          value={sameDayActions.otherDetails}
          onChange={(event) => updateDetails('otherDetails', event.target.value)}
        />
      </div>
    </div>
  );
}
