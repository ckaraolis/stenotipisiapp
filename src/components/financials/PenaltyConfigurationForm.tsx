import { useEffect, useState, type FormEvent } from 'react';
import {
  createPenaltyConfiguration,
  fetchPenaltyConfigurationById,
  updatePenaltyConfiguration,
} from '../../api/stenotypistPenalty';
import {
  DEFAULT_PENALTY_BASE_AMOUNT,
  DEFAULT_PENALTY_EXTRA_PER_HOUR,
  DEFAULT_PENALTY_GRACE_PERIOD_HOURS,
  parsePenaltyConfigurationError,
} from '../../config/stenotypistPenalty';
import type { StenotypistPenaltyConfigurationPayload } from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface PenaltyConfigurationFormProps {
  mode: 'create' | 'edit';
  configurationId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type PenaltyFormState = {
  gracePeriodHours: string;
  basePenalty: string;
  extraPenaltyPerHour: string;
  validFrom: string;
};

const EMPTY_FORM: PenaltyFormState = {
  gracePeriodHours: String(DEFAULT_PENALTY_GRACE_PERIOD_HOURS),
  basePenalty: String(DEFAULT_PENALTY_BASE_AMOUNT),
  extraPenaltyPerHour: String(DEFAULT_PENALTY_EXTRA_PER_HOUR),
  validFrom: '',
};

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  return parsePenaltyConfigurationError(message, t);
}

export default function PenaltyConfigurationForm({
  mode,
  configurationId,
  onCancel,
  onSaved,
}: PenaltyConfigurationFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PenaltyFormState>(EMPTY_FORM);

  useEffect(() => {
    if (mode !== 'edit' || !configurationId) return;
    let active = true;
    setLoading(true);
    fetchPenaltyConfigurationById(configurationId)
      .then((record) => {
        if (!active) return;
        setForm({
          gracePeriodHours: String(record.gracePeriodHours),
          basePenalty: String(record.basePenalty),
          extraPenaltyPerHour: String(record.extraPenaltyPerHour),
          validFrom: record.validFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('penaltyConfigurationNotFound'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configurationId, mode, t]);

  const validateClient = (): string => {
    const gracePeriodHours = Number(form.gracePeriodHours);
    if (!Number.isFinite(gracePeriodHours) || gracePeriodHours <= 0 || !Number.isInteger(gracePeriodHours)) {
      return t('penaltyConfigurationGracePeriodInvalid');
    }
    const basePenalty = Number(form.basePenalty);
    if (!Number.isFinite(basePenalty) || basePenalty <= 0) {
      return t('penaltyConfigurationBasePenaltyInvalid');
    }
    const extraPenaltyPerHour = Number(form.extraPenaltyPerHour);
    if (!Number.isFinite(extraPenaltyPerHour) || extraPenaltyPerHour <= 0) {
      return t('penaltyConfigurationExtraPenaltyPerHourInvalid');
    }
    if (!form.validFrom.trim()) return t('penaltyConfigurationValidFromRequired');
    return '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    setError('');
    const payload: StenotypistPenaltyConfigurationPayload = {
      gracePeriodHours: form.gracePeriodHours.trim(),
      basePenalty: form.basePenalty.trim(),
      extraPenaltyPerHour: form.extraPenaltyPerHour.trim(),
      validFrom: form.validFrom.trim(),
    };

    try {
      if (mode === 'edit' && configurationId) {
        await updatePenaltyConfiguration(configurationId, payload);
        onSaved(t('penaltyConfigurationUpdatedSuccess'));
      } else {
        await createPenaltyConfiguration(payload);
        onSaved(t('penaltyConfigurationCreatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">
            {mode === 'edit'
              ? t('penaltyConfigurationEditTitle')
              : t('penaltyConfigurationCreateTitle')}
          </h1>
          <p className="page-subtitle">{t('penaltyConfigurationSubtitle')}</p>
        </div>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="profile-grid">
              <label className="profile-label" htmlFor="penalty-grace-period">
                {t('penaltyGracePeriodHours')} *
              </label>
              <input
                id="penalty-grace-period"
                type="number"
                min="1"
                step="1"
                className="profile-input"
                value={form.gracePeriodHours}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, gracePeriodHours: event.target.value }));
                }}
              />

              <label className="profile-label" htmlFor="penalty-base-amount">
                {t('penaltyBaseAmountEur')} *
              </label>
              <input
                id="penalty-base-amount"
                type="number"
                min="0.01"
                step="0.01"
                className="profile-input"
                value={form.basePenalty}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, basePenalty: event.target.value }));
                }}
              />

              <label className="profile-label" htmlFor="penalty-extra-per-hour">
                {t('penaltyExtraPerHourEur')} *
              </label>
              <input
                id="penalty-extra-per-hour"
                type="number"
                min="0.01"
                step="0.01"
                className="profile-input"
                value={form.extraPenaltyPerHour}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, extraPenaltyPerHour: event.target.value }));
                }}
              />

              <label className="profile-label" htmlFor="penalty-valid-from">
                {t('validFrom')} *
              </label>
              <input
                id="penalty-valid-from"
                type="date"
                className="profile-input"
                value={form.validFrom}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, validFrom: event.target.value }));
                }}
              />
            </div>

            <div className="profile-actions">
              <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
