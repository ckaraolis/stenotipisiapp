import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface DeleteDistrictDialogProps {
  districtName: string;
  error?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteDistrictDialog({
  districtName,
  error,
  deleting,
  onCancel,
  onConfirm,
}: DeleteDistrictDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-district-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-district-title">{t('deleteDistrictTitle')}</h2>
        <p>{t('deleteDistrictMessage').replace('{name}', districtName)}</p>

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

export function parseDistrictDeleteError(
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
  return t('districtDeleteError');
}
