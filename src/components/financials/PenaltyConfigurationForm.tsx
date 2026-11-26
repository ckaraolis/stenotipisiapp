import { useEffect, useState, type FormEvent } from 'react';
import {
  createPenaltyConfiguration,
  fetchPenaltyConfigurationById,
  fetchPenaltyStenotypistCandidates,
  updatePenaltyConfiguration,
} from '../../api/stenotypistPenalty';
import {
  formatPenaltyConfigurationStenotypistLabel,
  parsePenaltyConfigurationError,
} from '../../config/stenotypistPenalty';
import type { StenotypistPenaltyConfigurationPayload } from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/financials.css';
import DateInput from '../common/DateInput';

interface PenaltyConfigurationFormProps {
  mode: 'create' | 'edit';
  configurationId?: string;
  onCancel: () => void;
  onSaved: (message: string, options?: { keepOpen?: boolean }) => void;
}

type PenaltyFormState = {
  stenotypistUserId: string;
  targetHoursBeforeDeadline: string;
  penaltyPerHourLate: string;
  validFrom: string;
};

const EMPTY_FORM: PenaltyFormState = {
  stenotypistUserId: '',
  targetHoursBeforeDeadline: '0',
  penaltyPerHourLate: '0',
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
  const [stenotypists, setStenotypists] = useState<
    Awaited<ReturnType<typeof fetchPenaltyStenotypistCandidates>>
  >([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PenaltyFormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    fetchPenaltyStenotypistCandidates()
      .then((rows) => {
        if (active) setStenotypists(rows);
      })
      .catch(() => {
        if (active) setError(t('penaltyConfigurationLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !configurationId) return;
    let active = true;
    setLoading(true);
    fetchPenaltyConfigurationById(configurationId)
      .then((record) => {
        if (!active) return;
        setForm({
          stenotypistUserId: record.stenotypistUserId,
          targetHoursBeforeDeadline: String(record.targetHoursBeforeDeadline),
          penaltyPerHourLate: String(record.penaltyPerHourLate),
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
    if (!form.stenotypistUserId.trim()) return t('penaltyConfigurationStenotypistRequired');
    const targetHours = Number(form.targetHoursBeforeDeadline);
    if (!Number.isFinite(targetHours) || targetHours <= 0 || !Number.isInteger(targetHours)) {
      return t('penaltyConfigurationTargetHoursInvalid');
    }
    const penaltyPerHourLate = Number(form.penaltyPerHourLate);
    if (!Number.isFinite(penaltyPerHourLate) || penaltyPerHourLate <= 0) {
      return t('penaltyConfigurationPenaltyPerHourLateInvalid');
    }
    if (!form.validFrom.trim()) return t('penaltyConfigurationValidFromRequired');
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
    const payload: StenotypistPenaltyConfigurationPayload = {
      stenotypistUserId: form.stenotypistUserId.trim(),
      targetHoursBeforeDeadline: form.targetHoursBeforeDeadline.trim(),
      penaltyPerHourLate: form.penaltyPerHourLate.trim(),
      validFrom: form.validFrom.trim(),
    };

    try {
      if (mode === 'edit' && configurationId) {
        await updatePenaltyConfiguration(configurationId, payload);
        onSaved(t('penaltyConfigurationUpdatedSuccess'));
      } else {
        await createPenaltyConfiguration(payload);
        if (keepOpen) {
          setForm(EMPTY_FORM);
          onSaved(t('penaltyConfigurationCreatedSuccess'), { keepOpen: true });
        } else {
          onSaved(t('penaltyConfigurationCreatedSuccess'));
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
        className="dialog-card dialog-card-wide penalty-configuration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="penalty-configuration-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card-header">
          <h2 id="penalty-configuration-dialog-title">
            {mode === 'edit'
              ? t('penaltyConfigurationEditTitle')
              : t('addNewPenaltyConfiguration')}
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
            className="penalty-configuration-dialog-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

            <div className="penalty-configuration-form-grid">
              <label className="profile-label" htmlFor="penalty-stenotypist">
                {t('stenotypist')}
              </label>
              <select
                id="penalty-stenotypist"
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
                    {formatPenaltyConfigurationStenotypistLabel(
                      stenotypist.fullName,
                      stenotypist.username,
                    )}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="penalty-target-hours">
                {t('targetHoursBeforeDeadline')}
              </label>
              <input
                id="penalty-target-hours"
                type="number"
                min="1"
                step="1"
                className="profile-input"
                value={form.targetHoursBeforeDeadline}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetHoursBeforeDeadline: event.target.value,
                  }))
                }
              />

              <label className="profile-label" htmlFor="penalty-per-hour-late">
                {t('penaltyPerHourLate')}
              </label>
              <input
                id="penalty-per-hour-late"
                type="number"
                min="0.01"
                step="0.01"
                className="profile-input"
                value={form.penaltyPerHourLate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, penaltyPerHourLate: event.target.value }))
                }
              />

              <label className="profile-label" htmlFor="penalty-valid-from">
                {t('validityFrom')}
              </label>
              <DateInput
                id="penalty-valid-from"
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
