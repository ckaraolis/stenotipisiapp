import { JOB_REJECTION_REASON_OPTIONS, jobRejectionReasonLabelKey } from '../../config/jobRecord';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface JobRejectDialogProps {
  jobNumber: string;
  rejectionReason: string;
  error?: string;
  saving: boolean;
  onRejectionReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function JobRejectDialog({
  jobNumber,
  rejectionReason,
  error,
  saving,
  onRejectionReasonChange,
  onCancel,
  onConfirm,
}: JobRejectDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-job-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reject-job-title">{t('rejectJobTitle')}</h2>
        <p>{t('rejectJobMessage').replace('{jobNumber}', jobNumber)}</p>

        <div className="profile-grid" style={{ marginTop: '16px' }}>
          <label className="profile-label" htmlFor="reject-job-reason">
            {t('rejectionReason')}
          </label>
          <select
            id="reject-job-reason"
            className="profile-input"
            value={rejectionReason}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
          >
            <option value="">{t('selectOption')}</option>
            {JOB_REJECTION_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {t(jobRejectionReasonLabelKey(reason))}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="button" className="dialog-delete-btn" onClick={onConfirm} disabled={saving}>
            {saving ? t('saving') : t('reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseJobActionError(
  message: string,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t(fallbackKey);
}
