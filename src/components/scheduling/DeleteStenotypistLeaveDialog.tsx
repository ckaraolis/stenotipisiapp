import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatStenotypistLeaveLabel } from '../../config/stenotypistLeave';
import type { StenotypistLeaveRecord } from '../../types/stenotypistLeave';
import '../../styles/profile.css';

interface DeleteStenotypistLeaveDialogProps {
  leave: StenotypistLeaveRecord;
  error?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteStenotypistLeaveDialog({
  leave,
  error,
  deleting,
  onCancel,
  onConfirm,
}: DeleteStenotypistLeaveDialogProps) {
  const { t } = useLanguage();
  const stenotypistLabel = formatStenotypistLeaveLabel(leave);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-stenotypist-leave-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-stenotypist-leave-title">{t('deleteStenotypistLeaveTitle')}</h2>
        <p>
          {t('deleteStenotypistLeaveMessage')
            .replace('{stenotypist}', stenotypistLabel)
            .replace('{dateFrom}', leave.dateFrom)
            .replace('{dateTo}', leave.dateTo)}
        </p>

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

export function parseStenotypistLeaveDeleteError(
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
  return t('stenotypistLeaveDeleteError');
}
