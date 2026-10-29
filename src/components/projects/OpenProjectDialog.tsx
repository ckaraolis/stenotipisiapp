import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface OpenProjectDialogProps {
  projectNumber: string;
  opening: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function OpenProjectDialog({
  projectNumber,
  opening,
  onCancel,
  onConfirm,
}: OpenProjectDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-project-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="open-project-title">{t('openProjectTitle')}</h2>
        <p>{t('openProjectMessage').replace('{number}', projectNumber)}</p>

        <div className="dialog-actions">
          <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={opening}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={opening}>
            {opening ? t('saving') : t('open')}
          </button>
        </div>
      </div>
    </div>
  );
}
