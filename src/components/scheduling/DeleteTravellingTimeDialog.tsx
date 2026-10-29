import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatTravellingTimeRoute } from '../../config/travellingTime';
import type { TravellingTimeRecord } from '../../types/travellingTime';
import '../../styles/profile.css';

interface DeleteTravellingTimeDialogProps {
  trip: TravellingTimeRecord;
  error?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteTravellingTimeDialog({
  trip,
  error,
  deleting,
  onCancel,
  onConfirm,
}: DeleteTravellingTimeDialogProps) {
  const { t } = useLanguage();
  const routeLabel = formatTravellingTimeRoute({
    district1Name: trip.district1Name,
    district1Alias: trip.district1Alias,
    district2Name: trip.district2Name,
    district2Alias: trip.district2Alias,
  });

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-travelling-time-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-travelling-time-title">{t('deleteTravellingTimeTitle')}</h2>
        <p>
          {t('deleteTravellingTimeMessage')
            .replace('{route}', routeLabel)
            .replace('{validityFrom}', trip.validityFrom)}
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

export function parseTravellingTimeDeleteError(
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
  return t('travellingTimeDeleteError');
}
