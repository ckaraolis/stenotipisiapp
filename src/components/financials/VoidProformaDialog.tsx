import type { ProformaRecord } from '../../types/proforma';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

type VoidStep = 'confirm' | 'warning';

interface VoidProformaDialogProps {
  proforma: ProformaRecord;
  step: VoidStep;
  voiding: boolean;
  error: string;
  onCancel: () => void;
  onProceed: () => void;
}

export default function VoidProformaDialog({
  proforma,
  step,
  voiding,
  error,
  onCancel,
  onProceed,
}: VoidProformaDialogProps) {
  const { t } = useLanguage();
  const customerName = proforma.customerName || proforma.customerLabel || '—';

  const message =
    step === 'confirm'
      ? t('proformaVoidConfirmMessage')
          .replace('{proformaNumber}', proforma.proformaNumber)
          .replace('{customerName}', customerName)
      : t('proformaVoidWarningMessage');

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="void-proforma-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="void-proforma-title">{t('proformaVoid')}</h2>
        <p>{message}</p>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={voiding}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-danger" onClick={onProceed} disabled={voiding}>
            {voiding ? t('saving') : t('proformaProceedToVoid')}
          </button>
        </div>
      </div>
    </div>
  );
}
