import { useEffect, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import { fetchDistrictOptions } from '../../api/districts';
import {
  createTravellingCharge,
  fetchTravellingChargeById,
  updateTravellingCharge,
} from '../../api/travellingCharges';
import {
  formatTravellingChargeAmountInput,
  normalizeTravellingChargeAmountInput,
} from '../../config/travellingCharges';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type { TravellingChargePayload } from '../../types/travellingCharges';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface TravellingChargeDetailsFormProps {
  mode: 'create' | 'edit';
  chargeId?: string;
  defaultCustomerId?: string;
  lockCustomer?: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type TravellingChargeFormState = {
  customerId: string;
  districtId: string;
  amount: string;
  validityFrom: string;
};

const EMPTY_FORM: TravellingChargeFormState = {
  customerId: '',
  districtId: '',
  amount: '',
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
  return t('travellingChargeSaveError');
}

export default function TravellingChargeDetailsForm({
  mode,
  chargeId,
  defaultCustomerId = '',
  lockCustomer = false,
  onCancel,
  onSaved,
}: TravellingChargeDetailsFormProps) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TravellingChargeFormState>({
    ...EMPTY_FORM,
    customerId: defaultCustomerId,
  });

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchDistrictOptions()])
      .then(([customerRows, districtRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setDistricts(districtRows);
      })
      .catch(() => {
        if (active) setError(t('travellingChargesLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !chargeId) return;
    let active = true;
    setLoading(true);
    fetchTravellingChargeById(chargeId)
      .then((charge) => {
        if (!active) return;
        setForm({
          customerId: charge.customerId,
          districtId: charge.districtId,
          amount: formatTravellingChargeAmountInput(charge.amount),
          validityFrom: charge.validityFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('travellingChargeLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chargeId, mode, t]);

  const validate = (): string => {
    if (!form.customerId.trim()) return t('travellingChargeCustomerRequired');
    if (!form.districtId.trim()) return t('travellingChargeDistrictRequired');
    const amount = normalizeTravellingChargeAmountInput(form.amount);
    if (amount === null) {
      return t('travellingChargeAmountRequired');
    }
    if (!form.validityFrom.trim()) return t('travellingChargeValidityFromRequired');
    return '';
  };

  const buildPayload = (): TravellingChargePayload => {
    const amount = normalizeTravellingChargeAmountInput(form.amount);
    if (amount === null) {
      throw new Error('travellingChargeAmountRequired');
    }
    return {
      customerId: form.customerId.trim(),
      districtId: form.districtId.trim(),
      amount,
      validityFrom: form.validityFrom.trim(),
    };
  };

  const handleAmountBlur = () => {
    const amount = normalizeTravellingChargeAmountInput(form.amount);
    if (amount === null) return;
    setForm((current) => ({ ...current, amount: formatTravellingChargeAmountInput(amount) }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createTravellingCharge(payload);
        onSaved(t('travellingChargeCreatedSuccess'));
      } else if (chargeId) {
        await updateTravellingCharge(chargeId, payload);
        onSaved(t('travellingChargeUpdatedSuccess'));
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
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create'
                ? t('travellingChargeDetailsCreateTitle')
                : t('travellingChargeDetailsEditTitle')}
            </h2>
          </div>

          {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="travelling-charge-customer">
              {t('customer')} *
            </label>
            <select
              id="travelling-charge-customer"
              className="profile-input"
              value={form.customerId}
              disabled={lockCustomer}
              onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="travelling-charge-district">
              {t('district')} *
            </label>
            <select
              id="travelling-charge-district"
              className="profile-input"
              value={form.districtId}
              onChange={(event) => setForm((current) => ({ ...current, districtId: event.target.value }))}
            >
              <option value="">{t('selectDistrict')}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {formatDistrictLabel(district)}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="travelling-charge-amount">
              {t('travellingChargeAmountEur')} *
            </label>
            <input
              id="travelling-charge-amount"
              type="number"
              min="0"
              step="0.01"
              className="profile-input"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              onBlur={handleAmountBlur}
            />

            <label className="profile-label" htmlFor="travelling-charge-validity-from">
              {t('validFrom')} *
            </label>
            <input
              id="travelling-charge-validity-from"
              type="date"
              className="profile-input"
              value={form.validityFrom}
              onChange={(event) =>
                setForm((current) => ({ ...current, validityFrom: event.target.value }))
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
      </div>
    </div>
  );
}
