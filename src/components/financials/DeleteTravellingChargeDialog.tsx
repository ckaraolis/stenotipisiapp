import { deleteTravellingCharge } from '../../api/travellingCharges';
import {
  formatTravellingChargeCustomerLabel,
  formatTravellingChargeDistrictLabel,
} from '../../config/travellingCharges';
import type { TravellingChargeRecord } from '../../types/travellingCharges';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface DeleteTravellingChargeDialogProps {
  charge: TravellingChargeRecord;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteTravellingChargeDialog({
  charge,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteTravellingChargeDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-travelling-charge-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-travelling-charge-title">{t('deleteTravellingChargeTitle')}</h2>
        <p>
          {t('deleteTravellingChargeMessage')
            .replace('{customer}', formatTravellingChargeCustomerLabel(charge))
            .replace('{district}', formatTravellingChargeDistrictLabel(charge))
            .replace('{validityFrom}', charge.validityFrom)}
        </p>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={deleting}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? t('saving') : t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseTravellingChargeDeleteError(
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
  return t('travellingChargeDeleteError');
}
