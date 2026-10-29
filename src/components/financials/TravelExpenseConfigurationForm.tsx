import { useEffect, useState, type FormEvent } from 'react';
import { fetchDistrictOptions } from '../../api/districts';
import {
  createTravelExpense,
  fetchTravelExpenseById,
  fetchTravelExpenseStenotypistCandidates,
  updateTravelExpense,
} from '../../api/travelExpenses';
import {
  formatTravelExpenseStenotypistLabel,
  parseTravelExpenseError,
} from '../../config/travelExpenses';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type { TravelExpenseConfigurationPayload } from '../../types/travelExpenses';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface TravelExpenseConfigurationFormProps {
  mode: 'create' | 'edit';
  configurationId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type TravelExpenseFormState = {
  stenotypistUserId: string;
  districtId: string;
  amount: string;
  validFrom: string;
};

const EMPTY_FORM: TravelExpenseFormState = {
  stenotypistUserId: '',
  districtId: '',
  amount: '',
  validFrom: '',
};

export default function TravelExpenseConfigurationForm({
  mode,
  configurationId,
  onCancel,
  onSaved,
}: TravelExpenseConfigurationFormProps) {
  const { t } = useLanguage();
  const [stenotypists, setStenotypists] = useState<
    Awaited<ReturnType<typeof fetchTravelExpenseStenotypistCandidates>>
  >([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TravelExpenseFormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTravelExpenseStenotypistCandidates(), fetchDistrictOptions()])
      .then(([stenotypistRows, districtRows]) => {
        if (!active) return;
        setStenotypists(stenotypistRows);
        setDistricts(districtRows);
      })
      .catch(() => {
        if (active) setError(t('travelExpenseLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !configurationId) return;
    let active = true;
    setLoading(true);
    fetchTravelExpenseById(configurationId)
      .then((record) => {
        if (!active) return;
        setForm({
          stenotypistUserId: record.stenotypistUserId,
          districtId: record.districtId,
          amount: Number(record.amount).toFixed(2),
          validFrom: record.validFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('travelExpenseNotFound'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configurationId, mode, t]);

  const validateClient = (): string => {
    if (!form.stenotypistUserId.trim()) return t('travelExpenseStenotypistRequired');
    if (!form.districtId.trim()) return t('travelExpenseDistrictRequired');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return t('travelExpenseAmountInvalid');
    }
    if (!form.validFrom.trim()) return t('travelExpenseValidFromRequired');
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
    const payload: TravelExpenseConfigurationPayload = {
      stenotypistUserId: form.stenotypistUserId.trim(),
      districtId: form.districtId.trim(),
      amount: form.amount.trim(),
      validFrom: form.validFrom.trim(),
    };

    try {
      if (mode === 'edit' && configurationId) {
        await updateTravelExpense(configurationId, payload);
        onSaved(t('travelExpenseUpdatedSuccess'));
      } else {
        await createTravelExpense(payload);
        onSaved(t('travelExpenseCreatedSuccess'));
      }
    } catch (err) {
      setError(parseTravelExpenseError((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">
            {mode === 'edit' ? t('travelExpenseEditTitle') : t('travelExpenseCreateTitle')}
          </h1>
          <p className="page-subtitle">{t('travExpConfigurationSubtitle')}</p>
        </div>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="profile-grid">
              <label className="profile-label" htmlFor="travel-expense-stenotypist">
                {t('stenotypist')} *
              </label>
              <select
                id="travel-expense-stenotypist"
                className="profile-input"
                value={form.stenotypistUserId}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, stenotypistUserId: event.target.value }));
                }}
              >
                <option value="">{t('selectStenotypist')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {formatTravelExpenseStenotypistLabel(stenotypist.fullName, stenotypist.username)}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="travel-expense-district">
                {t('district')} *
              </label>
              <select
                id="travel-expense-district"
                className="profile-input"
                value={form.districtId}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, districtId: event.target.value }));
                }}
              >
                <option value="">{t('selectDistrict')}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {formatDistrictLabel(district)}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="travel-expense-amount">
                {t('amount')} (€) *
              </label>
              <input
                id="travel-expense-amount"
                type="number"
                min="0.01"
                step="0.01"
                className="profile-input"
                value={form.amount}
                onChange={(event) => {
                  setError('');
                  setForm((current) => ({ ...current, amount: event.target.value }));
                }}
                onBlur={() => {
                  const amount = Number(form.amount);
                  if (Number.isFinite(amount) && amount > 0) {
                    setForm((current) => ({ ...current, amount: amount.toFixed(2) }));
                  }
                }}
              />

              <label className="profile-label" htmlFor="travel-expense-valid-from">
                {t('validFrom')} *
              </label>
              <input
                id="travel-expense-valid-from"
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
