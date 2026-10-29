import { useEffect, useState, type FormEvent } from 'react';
import {
  createBonusConfiguration,
  fetchBonusConfigurationById,
  fetchBonusStenotypistCandidates,
  updateBonusConfiguration,
} from '../../api/stenotypistBonus';
import {
  DEFAULT_BONUS_BASE_HOURS,
  DEFAULT_BONUS_PER_EXTRA_HOUR,
  formatBonusConfigurationStenotypistLabel,
  parseBonusConfigurationError,
} from '../../config/stenotypistBonus';
import type { StenotypistBonusConfigurationPayload } from '../../types/stenotypistBonus';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface BonusConfigurationFormProps {
  mode: 'create' | 'edit';
  configurationId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type BonusFormState = {
  stenotypistUserId: string;
  baseHours: string;
  bonusPerExtraHour: string;
  validFrom: string;
};

const EMPTY_FORM: BonusFormState = {
  stenotypistUserId: '',
  baseHours: String(DEFAULT_BONUS_BASE_HOURS),
  bonusPerExtraHour: String(DEFAULT_BONUS_PER_EXTRA_HOUR),
  validFrom: '',
};

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  return parseBonusConfigurationError(message, t);
}

export default function BonusConfigurationForm({
  mode,
  configurationId,
  onCancel,
  onSaved,
}: BonusConfigurationFormProps) {
  const { t } = useLanguage();
  const [stenotypists, setStenotypists] = useState<
    Awaited<ReturnType<typeof fetchBonusStenotypistCandidates>>
  >([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<BonusFormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    fetchBonusStenotypistCandidates()
      .then((rows) => {
        if (active) setStenotypists(rows);
      })
      .catch(() => {
        if (active) setError(t('bonusConfigurationLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !configurationId) return;
    let active = true;
    setLoading(true);
    fetchBonusConfigurationById(configurationId)
      .then((record) => {
        if (!active) return;
        setForm({
          stenotypistUserId: record.stenotypistUserId,
          baseHours: String(record.baseHours),
          bonusPerExtraHour: String(record.bonusPerExtraHour),
          validFrom: record.validFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('bonusConfigurationLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configurationId, mode, t]);

  const validateClient = (): string => {
    if (!form.stenotypistUserId.trim()) return t('bonusConfigurationStenotypistRequired');
    const baseHours = Number(form.baseHours);
    if (!Number.isFinite(baseHours) || baseHours <= 0) {
      return t('bonusConfigurationBaseHoursInvalid');
    }
    const bonusPerExtraHour = Number(form.bonusPerExtraHour);
    if (!Number.isFinite(bonusPerExtraHour) || bonusPerExtraHour <= 0) {
      return t('bonusConfigurationBonusPerExtraHourInvalid');
    }
    if (!form.validFrom.trim()) return t('bonusConfigurationValidFromRequired');
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
    const payload: StenotypistBonusConfigurationPayload = {
      stenotypistUserId: form.stenotypistUserId.trim(),
      baseHours: form.baseHours.trim(),
      bonusPerExtraHour: form.bonusPerExtraHour.trim(),
      validFrom: form.validFrom.trim(),
    };

    try {
      if (mode === 'edit' && configurationId) {
        await updateBonusConfiguration(configurationId, payload);
        onSaved(t('bonusConfigurationUpdatedSuccess'));
      } else {
        await createBonusConfiguration(payload);
        onSaved(t('bonusConfigurationCreatedSuccess'));
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
              ? t('bonusConfigurationEditTitle')
              : t('bonusConfigurationCreateTitle')}
          </h1>
          <p className="page-subtitle">{t('stenotypistBonusSubtitle')}</p>
        </div>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="profile-grid">
              <label className="profile-label" htmlFor="bonus-stenotypist">
                {t('stenotypist')} *
              </label>
              <select
                id="bonus-stenotypist"
                className="profile-input"
                value={form.stenotypistUserId}
                disabled={mode === 'edit'}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stenotypistUserId: event.target.value }))
                }
              >
                <option value="">{t('selectStenotypist')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {formatBonusConfigurationStenotypistLabel(
                      stenotypist.fullName,
                      stenotypist.username,
                    )}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="bonus-base-hours">
                {t('infoBaseHours')} *
              </label>
              <input
                id="bonus-base-hours"
                type="number"
                min="0.001"
                step="0.001"
                className="profile-input"
                value={form.baseHours}
                onChange={(event) =>
                  setForm((current) => ({ ...current, baseHours: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-per-extra-hour">
                {t('infoBonusPerExtraHour')} [€] *
              </label>
              <input
                id="bonus-per-extra-hour"
                type="number"
                min="0.01"
                step="0.01"
                className="profile-input"
                value={form.bonusPerExtraHour}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bonusPerExtraHour: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-valid-from">
                {t('validFrom')} *
              </label>
              <input
                id="bonus-valid-from"
                type="date"
                className="profile-input"
                value={form.validFrom}
                onChange={(event) =>
                  setForm((current) => ({ ...current, validFrom: event.target.value }))
                }
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
