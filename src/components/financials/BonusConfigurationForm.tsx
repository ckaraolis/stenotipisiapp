import { useEffect, useState, type FormEvent } from 'react';
import {
  createBonusConfiguration,
  fetchBonusConfigurationById,
  fetchBonusStenotypistCandidates,
  updateBonusConfiguration,
} from '../../api/stenotypistBonus';
import {
  formatBonusConfigurationStenotypistLabel,
  parseBonusConfigurationError,
} from '../../config/stenotypistBonus';
import type { StenotypistBonusConfigurationPayload } from '../../types/stenotypistBonus';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/financials.css';
import DateInput from '../common/DateInput';

interface BonusConfigurationFormProps {
  mode: 'create' | 'edit';
  configurationId?: string;
  onCancel: () => void;
  onSaved: (message: string, options?: { keepOpen?: boolean }) => void;
}

type BonusFormState = {
  stenotypistUserId: string;
  h1: string;
  h2: string;
  h1BonusEur: string;
  h2BonusEur: string;
  validFrom: string;
};

const EMPTY_FORM: BonusFormState = {
  stenotypistUserId: '',
  h1: '0',
  h2: '0',
  h1BonusEur: '0',
  h2BonusEur: '0',
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
          h1: String(record.h1),
          h2: String(record.h2),
          h1BonusEur: String(record.h1BonusEur),
          h2BonusEur: String(record.h2BonusEur),
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
    const h1 = Number(form.h1);
    if (!Number.isFinite(h1) || h1 <= 0) {
      return t('bonusConfigurationH1Invalid');
    }
    const h2 = Number(form.h2);
    if (!Number.isFinite(h2) || h2 <= 0) {
      return t('bonusConfigurationH2Invalid');
    }
    if (h2 < h1) {
      return t('bonusConfigurationH2LessThanH1');
    }
    const h1BonusEur = Number(form.h1BonusEur);
    if (!Number.isFinite(h1BonusEur) || h1BonusEur <= 0) {
      return t('bonusConfigurationH1BonusInvalid');
    }
    const h2BonusEur = Number(form.h2BonusEur);
    if (!Number.isFinite(h2BonusEur) || h2BonusEur <= 0) {
      return t('bonusConfigurationH2BonusInvalid');
    }
    if (!form.validFrom.trim()) return t('bonusConfigurationValidFromRequired');
    return '';
  };

  const saveConfiguration = async (keepOpen: boolean) => {
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    setError('');
    const payload: StenotypistBonusConfigurationPayload = {
      stenotypistUserId: form.stenotypistUserId.trim(),
      h1: form.h1.trim(),
      h2: form.h2.trim(),
      h1BonusEur: form.h1BonusEur.trim(),
      h2BonusEur: form.h2BonusEur.trim(),
      validFrom: form.validFrom.trim(),
    };

    try {
      if (mode === 'edit' && configurationId) {
        await updateBonusConfiguration(configurationId, payload);
        onSaved(t('bonusConfigurationUpdatedSuccess'));
      } else {
        await createBonusConfiguration(payload);
        if (keepOpen) {
          setForm(EMPTY_FORM);
          onSaved(t('bonusConfigurationCreatedSuccess'), { keepOpen: true });
        } else {
          onSaved(t('bonusConfigurationCreatedSuccess'));
        }
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void saveConfiguration(false);
  };

  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onClick={() => {
        if (!saving) onCancel();
      }}
    >
      <div
        className="dialog-card dialog-card-wide bonus-configuration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bonus-configuration-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card-header">
          <h2 id="bonus-configuration-dialog-title">
            {mode === 'edit'
              ? t('bonusConfigurationEditTitle')
              : t('addNewBonusConfiguration')}
          </h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onCancel}
            disabled={saving}
            aria-label={t('cancel')}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="profile-message">{t('loading')}</div>
        ) : (
          <form
            className="bonus-configuration-dialog-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

            <div className="bonus-configuration-form-grid">
              <label className="profile-label" htmlFor="bonus-stenotypist">
                {t('stenotypist')}
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

              <label className="profile-label" htmlFor="bonus-h1">
                {t('bonusH1Full')}
              </label>
              <input
                id="bonus-h1"
                type="number"
                min="0"
                step="0.001"
                className="profile-input"
                value={form.h1}
                onChange={(event) =>
                  setForm((current) => ({ ...current, h1: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-h2">
                {t('bonusH2Full')}
              </label>
              <input
                id="bonus-h2"
                type="number"
                min="0"
                step="0.001"
                className="profile-input"
                value={form.h2}
                onChange={(event) =>
                  setForm((current) => ({ ...current, h2: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-h1b">
                {t('bonusH1BFull')}
              </label>
              <input
                id="bonus-h1b"
                type="number"
                min="0"
                step="0.01"
                className="profile-input"
                value={form.h1BonusEur}
                onChange={(event) =>
                  setForm((current) => ({ ...current, h1BonusEur: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-h2b">
                {t('bonusH2BFull')}
              </label>
              <input
                id="bonus-h2b"
                type="number"
                min="0"
                step="0.01"
                className="profile-input"
                value={form.h2BonusEur}
                onChange={(event) =>
                  setForm((current) => ({ ...current, h2BonusEur: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="bonus-valid-from">
                {t('validityFrom')}
              </label>
              <DateInput
                id="bonus-valid-from"
                className="profile-input"
                value={form.validFrom}
                onChange={(event) =>
                  setForm((current) => ({ ...current, validFrom: event.target.value }))
                }
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="profile-cancel-btn"
                onClick={onCancel}
                disabled={saving}
              >
                {t('cancel')}
              </button>
              <button type="submit" className="profile-submit" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
              {mode === 'create' ? (
                <button
                  type="button"
                  className="profile-submit"
                  disabled={saving}
                  onClick={() => void saveConfiguration(true)}
                >
                  {saving ? t('saving') : t('saveAndAddNew')}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
