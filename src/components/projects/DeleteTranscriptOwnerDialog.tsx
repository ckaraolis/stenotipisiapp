import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface DeleteTranscriptOwnerDialogProps {
  ownerName: string;
  error?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteTranscriptOwnerDialog({
  ownerName,
  error,
  deleting,
  onCancel,
  onConfirm,
}: DeleteTranscriptOwnerDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-transcript-owner-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-transcript-owner-title">{t('deleteTranscriptOwnerTitle')}</h2>
        <p>{t('deleteTranscriptOwnerMessage').replace('{name}', ownerName)}</p>

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

export function parseTranscriptOwnerDeleteError(
  message: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('projectTranscriptOwnerDeleteError');
}
