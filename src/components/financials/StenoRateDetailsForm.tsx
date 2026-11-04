import { useEffect, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  createStenoRate,
  fetchStenoRateById,
  updateStenoRate,
} from '../../api/stenoRates';
import { SLA_OPTIONS } from '../../types/customer';
import type { StenoRatePayload } from '../../types/stenoRates';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/financials.css';

interface StenoRateDetailsFormProps {
  mode: 'create' | 'edit';
  rateId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type StenoRateFormState = {
  customerId: string;
  hourlyRate: string;
  hourlyRateExpedited: string;
  hourlyRateOutsideWorkingHrs: string;
  hourlyRateOutsideWorkingHrsExpedited: string;
  firstDiscountPercentage: string;
  nrExemptedStenotypists: string;
  secondDiscountPercentage: string;
  secondStenotypistDiscountThreshold: string;
  travelByKmAmount: string;
  sla: string;
  slaExpedited: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  validityFrom: string;
};

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyForm(): StenoRateFormState {
  return {
    customerId: '',
    hourlyRate: '0',
    hourlyRateExpedited: '0',
    hourlyRateOutsideWorkingHrs: '0',
    hourlyRateOutsideWorkingHrsExpedited: '0',
    firstDiscountPercentage: '0',
    nrExemptedStenotypists: '0',
    secondDiscountPercentage: '0',
    secondStenotypistDiscountThreshold: '0',
    travelByKmAmount: '0',
    sla: '1 day',
    slaExpedited: '1 day',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    validityFrom: getTodayDate(),
  };
}

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('stenoRateSaveError');
}

function toPayload(form: StenoRateFormState): StenoRatePayload {
  return {
    customerId: form.customerId,
    hourlyRate: form.hourlyRate,
    hourlyRateExpedited: form.hourlyRateExpedited,
    hourlyRateOutsideWorkingHrs: form.hourlyRateOutsideWorkingHrs,
    hourlyRateOutsideWorkingHrsExpedited: form.hourlyRateOutsideWorkingHrsExpedited,
    firstDiscountPercentage: form.firstDiscountPercentage,
    nrExemptedStenotypists: form.nrExemptedStenotypists,
    secondDiscountPercentage: form.secondDiscountPercentage,
    secondStenotypistDiscountThreshold: form.secondStenotypistDiscountThreshold,
    travelByKmAmount: form.travelByKmAmount,
    sla: form.sla,
    slaExpedited: form.slaExpedited,
    workingHoursStart: form.workingHoursStart,
    workingHoursEnd: form.workingHoursEnd,
    validityFrom: form.validityFrom,
  };
}

function normalizeSlaValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  const match = SLA_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match ?? SLA_OPTIONS[0];
}

export default function StenoRateDetailsForm({
  mode,
  rateId,
  onCancel,
  onSaved,
}: StenoRateDetailsFormProps) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<StenoRateFormState>(createEmptyForm);

  useEffect(() => {
    let active = true;
    fetchCustomers()
      .then((rows) => {
        if (active) setCustomers(rows);
      })
      .catch(() => {
        if (active) setError(t('stenoRatesLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !rateId) {
      setForm(createEmptyForm());
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchStenoRateById(rateId)
      .then((rate) => {
        if (!active) return;
        setForm({
          customerId: rate.customerId,
          hourlyRate: String(rate.hourlyRate ?? 0),
          hourlyRateExpedited: String(rate.hourlyRateExpedited ?? 0),
          hourlyRateOutsideWorkingHrs: String(rate.hourlyRateOutsideWorkingHrs ?? 0),
          hourlyRateOutsideWorkingHrsExpedited: String(
            rate.hourlyRateOutsideWorkingHrsExpedited ?? 0,
          ),
          firstDiscountPercentage: String(rate.firstDiscountPercentage ?? 0),
          nrExemptedStenotypists: String(rate.nrExemptedStenotypists ?? 0),
          secondDiscountPercentage: String(rate.secondDiscountPercentage ?? 0),
          secondStenotypistDiscountThreshold: String(rate.secondStenotypistDiscountThreshold ?? 0),
          travelByKmAmount: String(rate.travelByKmAmount ?? 0),
          sla: normalizeSlaValue(rate.sla || '1 day'),
          slaExpedited: normalizeSlaValue(rate.slaExpedited || '1 day'),
          workingHoursStart: rate.workingHoursStart || '09:00',
          workingHoursEnd: rate.workingHoursEnd || '17:00',
          validityFrom: rate.validityFrom || getTodayDate(),
        });
      })
      .catch(() => {
        if (active) setError(t('stenoRateLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rateId, mode, t]);

  const updateField = <K extends keyof StenoRateFormState>(key: K, value: StenoRateFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerId.trim()) {
      setError(t('stenoRateCustomerRequired'));
      return;
    }
    if (!form.validityFrom.trim()) {
      setError(t('stenoRateValidityFromRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (mode === 'edit' && rateId) {
        await updateStenoRate(rateId, payload);
        onSaved(t('stenoRateUpdatedSuccess'));
      } else {
        await createStenoRate(payload);
        onSaved(t('stenoRateCreatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
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
        className="dialog-card dialog-card-wide steno-rate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="steno-rate-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card-header">
          <h2 id="steno-rate-dialog-title">
            {mode === 'edit' ? t('editStenoRate') : t('addStenoRate')}
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
          <form className="steno-rate-dialog-form" onSubmit={(event) => void handleSubmit(event)}>
            {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

            <div className="steno-rate-form-grid">
              <label className="profile-label" htmlFor="steno-rate-customer">
                {t('customer')}
              </label>
              <select
                id="steno-rate-customer"
                className="profile-input"
                value={form.customerId}
                onChange={(event) => updateField('customerId', event.target.value)}
                disabled={mode === 'edit'}
                required
              >
                <option value="">{t('selectCustomer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="steno-rate-hourly">
                {t('hourlyRate')}
              </label>
              <input
                id="steno-rate-hourly"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.hourlyRate}
                onChange={(event) => updateField('hourlyRate', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-hourly-exp">
                {t('hourlyRateExpedited')}
              </label>
              <input
                id="steno-rate-hourly-exp"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.hourlyRateExpedited}
                onChange={(event) => updateField('hourlyRateExpedited', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-hourly-owh">
                {t('hourlyRateOutsideWorkingHrs')}
              </label>
              <input
                id="steno-rate-hourly-owh"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.hourlyRateOutsideWorkingHrs}
                onChange={(event) => updateField('hourlyRateOutsideWorkingHrs', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-hourly-owh-exp">
                {t('hourlyRateOutsideWorkingHrsExpedited')}
              </label>
              <input
                id="steno-rate-hourly-owh-exp"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.hourlyRateOutsideWorkingHrsExpedited}
                onChange={(event) =>
                  updateField('hourlyRateOutsideWorkingHrsExpedited', event.target.value)
                }
              />

              <label className="profile-label" htmlFor="steno-rate-discount-1">
                {t('firstDiscountPercentage')}
              </label>
              <input
                id="steno-rate-discount-1"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.firstDiscountPercentage}
                onChange={(event) => updateField('firstDiscountPercentage', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-exempted">
                {t('nrExemptedStenotypists')}
              </label>
              <input
                id="steno-rate-exempted"
                type="number"
                step="1"
                min="0"
                className="profile-input"
                value={form.nrExemptedStenotypists}
                onChange={(event) => updateField('nrExemptedStenotypists', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-discount-2">
                {t('secondDiscountPercentage')}
              </label>
              <input
                id="steno-rate-discount-2"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.secondDiscountPercentage}
                onChange={(event) => updateField('secondDiscountPercentage', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-threshold">
                {t('secondStenotypistDiscountThreshold')}
              </label>
              <input
                id="steno-rate-threshold"
                type="number"
                step="1"
                min="0"
                className="profile-input"
                value={form.secondStenotypistDiscountThreshold}
                onChange={(event) =>
                  updateField('secondStenotypistDiscountThreshold', event.target.value)
                }
              />

              <label className="profile-label" htmlFor="steno-rate-travel-km">
                {t('travelByKmAmount')}
              </label>
              <input
                id="steno-rate-travel-km"
                type="number"
                step="0.01"
                min="0"
                className="profile-input"
                value={form.travelByKmAmount}
                onChange={(event) => updateField('travelByKmAmount', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-sla">
                {t('sla')}
              </label>
              <select
                id="steno-rate-sla"
                className="profile-input"
                value={form.sla}
                onChange={(event) => updateField('sla', event.target.value)}
              >
                {SLA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="steno-rate-sla-exp">
                {t('slaExpedited')}
              </label>
              <select
                id="steno-rate-sla-exp"
                className="profile-input"
                value={form.slaExpedited}
                onChange={(event) => updateField('slaExpedited', event.target.value)}
              >
                {SLA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label className="profile-label" htmlFor="steno-rate-hours-start">
                {t('workingHoursStart')}
              </label>
              <input
                id="steno-rate-hours-start"
                type="time"
                className="profile-input"
                value={form.workingHoursStart}
                onChange={(event) => updateField('workingHoursStart', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-hours-end">
                {t('workingHoursEnd')}
              </label>
              <input
                id="steno-rate-hours-end"
                type="time"
                className="profile-input"
                value={form.workingHoursEnd}
                onChange={(event) => updateField('workingHoursEnd', event.target.value)}
              />

              <label className="profile-label" htmlFor="steno-rate-validity">
                {t('validityFrom')}
              </label>
              <input
                id="steno-rate-validity"
                type="date"
                className="profile-input"
                value={form.validityFrom}
                onChange={(event) => updateField('validityFrom', event.target.value)}
                required
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
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
