import type { JobSubmissionReceiptData } from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';
import TimeDigitsInput from './TimeDigitsInput';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface JobReceiptFormProps {
  receipt: JobSubmissionReceiptData;
  onChange: (receipt: JobSubmissionReceiptData) => void;
  error?: string;
  onError: (message: string) => void;
}

export default function JobReceiptForm({ receipt, onChange, error, onError }: JobReceiptFormProps) {
  const { t } = useLanguage();

  const updateReceipt = (
    field: keyof JobSubmissionReceiptData,
    value: string,
    options?: { zeroPadToFive?: boolean },
  ) => {
    const nextValue =
      options?.zeroPadToFive && value
        ? value.replace(/\D/g, '').slice(0, 5).padStart(5, '0')
        : value;
    onError('');
    onChange({
      ...receipt,
      [field]: nextValue,
    });
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepJobReceipt')}</h3>
      <p className="workflow-wizard-step-description">{t('jobSubmissionStepJobReceiptDescription')}</p>
      <p className="profile-field-hint">{t('jobSubmissionTimeQuickEntryHint')}</p>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}

      <div className="profile-grid">
        <label className="profile-label" htmlFor="receipt-number-stenotypist">
          {t('receiptNumberStenotypist')}
        </label>
        <input
          id="receipt-number-stenotypist"
          type="text"
          className="profile-input"
          inputMode="numeric"
          maxLength={5}
          value={receipt.receiptNumberStenotypist}
          onChange={(event) =>
            updateReceipt(
              'receiptNumberStenotypist',
              event.target.value.replace(/\D/g, '').slice(0, 5),
            )
          }
          onBlur={(event) =>
            updateReceipt('receiptNumberStenotypist', event.target.value, { zeroPadToFive: true })
          }
        />

        <TimeDigitsInput
          id="start-time-stenotypist"
          label={t('startTimeStenotypist')}
          value={receipt.startTimeStenotypist}
          onChange={(value) => updateReceipt('startTimeStenotypist', value)}
        />

        <TimeDigitsInput
          id="end-time-stenotypist"
          label={t('endTimeStenotypist')}
          value={receipt.endTimeStenotypist}
          onChange={(value) => updateReceipt('endTimeStenotypist', value)}
        />
      </div>
    </div>
  );
}
