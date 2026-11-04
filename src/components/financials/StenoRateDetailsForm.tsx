import { useEffect, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  createStenoRate,
  fetchStenoRateById,
  updateStenoRate,
} from '../../api/stenoRates';
import type { StenoRatePayload } from '../../types/stenoRates';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';
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

const EMPTY_FORM: StenoRateFormState = {
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
  slaExpedited: '',
  workingHoursStart: '',
  workingHoursEnd: '',
  validityFrom: '',
};

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
  const [form, setForm] = useState<StenoRateFormState>(EMPTY_FORM);

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
    if (mode !== 'edit' || !rateId) return;
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
          sla: rate.sla ?? '1 day',
          slaExpedited: rate.slaExpedited ?? '',
          workingHoursStart: rate.workingHoursStart ?? '',
          workingHoursEnd: rate.workingHoursEnd ?? '',
          validityFrom: rate.validityFrom ?? '',
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

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">
            {mode === 'edit' ? t('editStenoRate') : t('addStenoRate')}
          </h1>
          <p className="page-subtitle">{t('stenoRatesSubtitle')}</p>
        </div>
      </div>

      <form className="profile-form financials-panel" onSubmit={(event) => void handleSubmit(event)}>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

        <div className="profile-grid">
          <label className="profile-label">
            {t('customer')}
            <select
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
          </label>

          <label className="profile-label">
            {t('validityFrom')}
            <input
              type="date"
              className="profile-input"
              value={form.validityFrom}
              onChange={(event) => updateField('validityFrom', event.target.value)}
              required
            />
          </label>

          <label className="profile-label">
            {t('hourlyRate')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.hourlyRate}
              onChange={(event) => updateField('hourlyRate', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('hourlyRateExpedited')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.hourlyRateExpedited}
              onChange={(event) => updateField('hourlyRateExpedited', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('hourlyRateOutsideWorkingHrs')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.hourlyRateOutsideWorkingHrs}
              onChange={(event) => updateField('hourlyRateOutsideWorkingHrs', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('hourlyRateOutsideWorkingHrsExpedited')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.hourlyRateOutsideWorkingHrsExpedited}
              onChange={(event) =>
                updateField('hourlyRateOutsideWorkingHrsExpedited', event.target.value)
              }
            />
          </label>

          <label className="profile-label">
            {t('firstDiscountPercentage')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.firstDiscountPercentage}
              onChange={(event) => updateField('firstDiscountPercentage', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('nrExemptedStenotypists')}
            <input
              type="number"
              step="1"
              min="0"
              className="profile-input"
              value={form.nrExemptedStenotypists}
              onChange={(event) => updateField('nrExemptedStenotypists', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('secondDiscountPercentage')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.secondDiscountPercentage}
              onChange={(event) => updateField('secondDiscountPercentage', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('secondStenotypistDiscountThreshold')}
            <input
              type="number"
              step="1"
              min="0"
              className="profile-input"
              value={form.secondStenotypistDiscountThreshold}
              onChange={(event) =>
                updateField('secondStenotypistDiscountThreshold', event.target.value)
              }
            />
          </label>

          <label className="profile-label">
            {t('travelByKmAmount')}
            <input
              type="number"
              step="0.01"
              min="0"
              className="profile-input"
              value={form.travelByKmAmount}
              onChange={(event) => updateField('travelByKmAmount', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('sla')}
            <input
              type="text"
              className="profile-input"
              value={form.sla}
              onChange={(event) => updateField('sla', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('slaExpedited')}
            <input
              type="text"
              className="profile-input"
              value={form.slaExpedited}
              onChange={(event) => updateField('slaExpedited', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('workingHoursStart')}
            <input
              type="time"
              className="profile-input"
              value={form.workingHoursStart}
              onChange={(event) => updateField('workingHoursStart', event.target.value)}
            />
          </label>

          <label className="profile-label">
            {t('workingHoursEnd')}
            <input
              type="time"
              className="profile-input"
              value={form.workingHoursEnd}
              onChange={(event) => updateField('workingHoursEnd', event.target.value)}
            />
          </label>
        </div>

        <div className="profile-actions">
          <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="submit" className="profile-submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
