import type { StenotypistPenaltyConfigurationRecord } from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface DeletePenaltyConfigurationDialogProps {
  configuration: StenotypistPenaltyConfigurationRecord;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeletePenaltyConfigurationDialog({
  configuration,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeletePenaltyConfigurationDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-penalty-configuration-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-penalty-configuration-title">{t('deletePenaltyConfigurationTitle')}</h2>
        <p>
          {t('deletePenaltyConfigurationMessage').replace('{validFrom}', configuration.validFrom)}
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
