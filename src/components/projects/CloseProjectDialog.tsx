import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface CloseProjectDialogProps {
  projectNumber: string;
  closing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CloseProjectDialog({
  projectNumber,
  closing,
  onCancel,
  onConfirm,
}: CloseProjectDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-project-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="close-project-title">{t('closeProjectTitle')}</h2>
        <p>{t('closeProjectMessage').replace('{number}', projectNumber)}</p>

        <div className="dialog-actions">
          <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={closing}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={closing}>
            {closing ? t('saving') : t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
