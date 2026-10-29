import { useEffect, useState, type FormEvent } from 'react';
import { createCustomer, fetchCustomerById, updateCustomer } from '../../api/customers';
import {
  FIELD_STATUS_OPTIONS,
  SLA_OPTIONS,
  TRAVELLING_CHARGES_OPTIONS,
  type CustomerFieldStatus,
  type CustomerPayload,
  type CustomerSla,
  type TravellingCharges,
} from '../../types/customer';
import { fieldStatusLabelKey, travellingChargesLabelKey } from '../../config/customer';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface CustomerDetailsFormProps {
  mode: 'create' | 'edit';
  customerId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type CustomerFormState = {
  customerNumber: string;
  name: string;
  alias: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  hourlyRate: string;
  sla: CustomerSla | '';
  travellingCharges: TravellingCharges;
  remarks: string;
  field1Status: CustomerFieldStatus;
  field1Name: string;
  field2Status: CustomerFieldStatus;
  field2Name: string;
  field3Status: CustomerFieldStatus;
  field3Name: string;
  field4Status: CustomerFieldStatus;
  field4Name: string;
};

const EMPTY_FORM: CustomerFormState = {
  customerNumber: '',
  name: '',
  alias: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  hourlyRate: '',
  sla: '',
  travellingCharges: 'non_billable',
  remarks: '',
  field1Status: 'invisible',
  field1Name: '',
  field2Status: 'invisible',
  field2Name: '',
  field3Status: 'invisible',
  field3Name: '',
  field4Status: 'invisible',
  field4Name: '',
};

const FIELD_KEYS = [1, 2, 3, 4] as const;

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('customerSaveError');
}

export default function CustomerDetailsForm({
  mode,
  customerId,
  onCancel,
  onSaved,
}: CustomerDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);

  useEffect(() => {
    if (mode !== 'edit' || !customerId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchCustomerById(customerId)
      .then((customer) => {
        if (!active) return;
        setForm({
          customerNumber: customer.customerNumber,
          name: customer.name,
          alias: customer.alias,
          contactPerson: customer.contactPerson,
          contactPhone: customer.contactPhone,
          contactEmail: customer.contactEmail,
          hourlyRate: customer.hourlyRate.toFixed(2),
          sla: customer.sla,
          travellingCharges: customer.travellingCharges,
          remarks: customer.remarks,
          field1Status: customer.field1Status,
          field1Name: customer.field1Name,
          field2Status: customer.field2Status,
          field2Name: customer.field2Name,
          field3Status: customer.field3Status,
          field3Name: customer.field3Name,
          field4Status: customer.field4Status,
          field4Name: customer.field4Name,
        });
      })
      .catch(() => {
        if (active) setError(t('customerLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, customerId, t]);

  const validateClient = (): string | null => {
    if (!form.name.trim()) return t('customerNameRequired');
    if (!form.alias.trim()) return t('customerAliasRequired');
    if (!form.hourlyRate.trim()) return t('customerHourlyRateRequired');
    if (Number.isNaN(Number.parseFloat(form.hourlyRate))) return t('customerHourlyRateRequired');
    if (!form.sla) return t('customerSlaRequired');
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      return t('emailInvalid');
    }
    if (form.remarks.length > 300) return t('customerRemarksTooLong');
    return null;
  };

  const buildPayload = (): CustomerPayload => ({
    name: form.name.trim(),
    alias: form.alias.trim(),
    contactPerson: form.contactPerson.trim(),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim(),
    hourlyRate: Number.parseFloat(form.hourlyRate),
    sla: form.sla,
    travellingCharges: form.travellingCharges,
    remarks: form.remarks.trim(),
    field1Status: form.field1Status,
    field1Name: form.field1Status === 'invisible' ? form.field1Name : form.field1Name.trim(),
    field2Status: form.field2Status,
    field2Name: form.field2Status === 'invisible' ? form.field2Name : form.field2Name.trim(),
    field3Status: form.field3Status,
    field3Name: form.field3Status === 'invisible' ? form.field3Name : form.field3Name.trim(),
    field4Status: form.field4Status,
    field4Name: form.field4Status === 'invisible' ? form.field4Name : form.field4Name.trim(),
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createCustomer(payload);
        onSaved(t('customerCreatedSuccess'));
      } else if (customerId) {
        await updateCustomer(customerId, payload);
        onSaved(t('customerUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateFieldStatus = (fieldNumber: 1 | 2 | 3 | 4, status: CustomerFieldStatus) => {
    setForm((current) => ({
      ...current,
      [`field${fieldNumber}Status`]: status,
    }));
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
              {mode === 'create' ? t('customerDetailsCreateTitle') : t('customerDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="customer-number">
              {t('customerNumber')}
            </label>
            <input
              id="customer-number"
              className="profile-input profile-input-readonly"
              value={mode === 'create' ? t('customerNumberAuto') : form.customerNumber}
              readOnly
            />

            <label className="profile-label" htmlFor="customer-name">
              {t('name')} *
            </label>
            <input
              id="customer-name"
              className="profile-input"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-alias">
              {t('alias')} *
            </label>
            <input
              id="customer-alias"
              className="profile-input"
              value={form.alias}
              onChange={(e) => updateField('alias', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-contact-person">
              {t('contactPerson')}
            </label>
            <input
              id="customer-contact-person"
              className="profile-input"
              value={form.contactPerson}
              onChange={(e) => updateField('contactPerson', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-contact-phone">
              {t('contactPhone')}
            </label>
            <input
              id="customer-contact-phone"
              className="profile-input"
              value={form.contactPhone}
              onChange={(e) => updateField('contactPhone', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-contact-email">
              {t('contactEmail')}
            </label>
            <input
              id="customer-contact-email"
              type="email"
              className="profile-input"
              value={form.contactEmail}
              onChange={(e) => updateField('contactEmail', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-hourly-rate">
              {t('hourlyRate')} *
            </label>
            <input
              id="customer-hourly-rate"
              type="number"
              min="0"
              step="0.01"
              className="profile-input"
              value={form.hourlyRate}
              onChange={(e) => updateField('hourlyRate', e.target.value)}
            />

            <label className="profile-label" htmlFor="customer-sla">
              {t('serviceLevelAgreement')} *
            </label>
            <select
              id="customer-sla"
              className="profile-input"
              value={form.sla}
              onChange={(e) => updateField('sla', e.target.value as CustomerSla)}
            >
              <option value="">{t('selectOption')}</option>
              {SLA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="customer-travelling-charges">
              {t('travellingCharges')}
            </label>
            <select
              id="customer-travelling-charges"
              className="profile-input"
              value={form.travellingCharges}
              onChange={(e) =>
                updateField('travellingCharges', e.target.value as TravellingCharges)
              }
            >
              {TRAVELLING_CHARGES_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(travellingChargesLabelKey(option))}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="customer-remarks">
              {t('remarks')}
            </label>
            <textarea
              id="customer-remarks"
              className="profile-input customer-remarks-input"
              maxLength={300}
              rows={3}
              value={form.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
            />
            <p className="profile-field-hint profile-grid-span">
              {t('customerRemarksHint').replace('{count}', String(form.remarks.length))}
            </p>
          </div>

          <div className="customer-custom-fields">
            <h3>{t('customerCustomFields')}</h3>
            <div className="profile-grid">
              {FIELD_KEYS.map((fieldNumber) => {
                const statusKey = `field${fieldNumber}Status` as const;
                const nameKey = `field${fieldNumber}Name` as const;
                const status = form[statusKey];
                const name = form[nameKey];
                const statusLabelKey =
                  fieldNumber === 1
                    ? 'field1Status'
                    : fieldNumber === 2
                      ? 'field2Status'
                      : fieldNumber === 3
                        ? 'field3Status'
                        : 'field4Status';
                const nameLabelKey =
                  fieldNumber === 1
                    ? 'field1Name'
                    : fieldNumber === 2
                      ? 'field2Name'
                      : fieldNumber === 3
                        ? 'field3Name'
                        : 'field4Name';

                return (
                  <div key={fieldNumber} className="customer-field-group profile-grid-span">
                    <label className="profile-label" htmlFor={`${statusKey}-select`}>
                      {t(statusLabelKey)}
                    </label>
                    <select
                      id={`${statusKey}-select`}
                      className="profile-input"
                      value={status}
                      onChange={(e) =>
                        updateFieldStatus(fieldNumber, e.target.value as CustomerFieldStatus)
                      }
                    >
                      {FIELD_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(fieldStatusLabelKey(option))}
                        </option>
                      ))}
                    </select>

                    <label className="profile-label" htmlFor={`${nameKey}-input`}>
                      {t(nameLabelKey)}
                    </label>
                    <input
                      id={`${nameKey}-input`}
                      className="profile-input"
                      value={name}
                      readOnly={status === 'invisible'}
                      onChange={(e) => updateField(nameKey, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel}>
              {t('cancel')}
            </button>
            <button type="submit" className="profile-submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
