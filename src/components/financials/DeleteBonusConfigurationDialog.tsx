import { formatBonusConfigurationStenotypistLabel } from '../../config/stenotypistBonus';
import type { StenotypistBonusConfigurationRecord } from '../../types/stenotypistBonus';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface DeleteBonusConfigurationDialogProps {
  configuration: StenotypistBonusConfigurationRecord;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteBonusConfigurationDialog({
  configuration,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteBonusConfigurationDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-bonus-configuration-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-bonus-configuration-title">{t('deleteBonusConfigurationTitle')}</h2>
        <p>
          {t('deleteBonusConfigurationMessage')
            .replace(
              '{stenotypist}',
              formatBonusConfigurationStenotypistLabel(
                configuration.stenotypistFullName,
                configuration.stenotypistUsername,
              ),
            )
            .replace('{validFrom}', configuration.validFrom)}
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
