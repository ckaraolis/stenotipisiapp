import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface JobDeleteDialogProps {
  jobNumber: string;
  error?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function JobDeleteDialog({
  jobNumber,
  error,
  deleting,
  onCancel,
  onConfirm,
}: JobDeleteDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-job-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-job-title">{t('deleteJobTitle')}</h2>
        <p>{t('deleteJobMessage').replace('{jobNumber}', jobNumber)}</p>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={deleting}>
            {t('cancel')}
          </button>
          <button type="button" className="dialog-delete-btn" onClick={onConfirm} disabled={deleting}>
            {deleting ? t('saving') : t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
