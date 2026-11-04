import type { TravelExpenseConfigurationRecord } from '../../types/travelExpenses';
import {
  formatTravelExpenseDistrictLabel,
  formatTravelExpenseStenotypistLabel,
} from '../../config/travelExpenses';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import '../../styles/profile.css';

interface DeleteTravelExpenseDialogProps {
  configuration: TravelExpenseConfigurationRecord;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteTravelExpenseDialog({
  configuration,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteTravelExpenseDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-travel-expense-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-travel-expense-title">{t('deleteTravelExpenseTitle')}</h2>
        <p>
          {t('deleteTravelExpenseMessage')
            .replace(
              '{stenotypist}',
              formatTravelExpenseStenotypistLabel(
                configuration.stenotypistFullName,
                configuration.stenotypistUsername,
              ),
            )
            .replace(
              '{district}',
              formatTravelExpenseDistrictLabel(
                configuration.districtName,
                configuration.districtAlias,
              ),
            )
            .replace('{validFrom}', formatDateDisplay(configuration.validFrom))}
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
