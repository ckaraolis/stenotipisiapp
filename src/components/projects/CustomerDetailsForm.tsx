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
import '../../styles/projects.css';

interface CustomerDetailsFormProps {
  mode: 'create' | 'edit';
  customerId?: string;
  onCancel: () => void;
  onSaved: (message: string, next?: 'close' | 'add-another') => void;
}

type CustomerFormTab = 'basic' | 'steno' | 'audio' | 'captions';

type CustomerFormState = {
  customerNumber: string;
  name: string;
  alias: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  paymentTerms: string;
  priorityErpNumber: string;
  hourlyRate: string;
  sla: CustomerSla | '';
  travellingCharges: TravellingCharges;
  remarks: string;
  isStenoCustomer: boolean;
  isAudioCustomer: boolean;
  isCaptionsCustomer: boolean;
  enabled: boolean;
  field1Status: CustomerFieldStatus;
  field1Name: string;
  field2Status: CustomerFieldStatus;
  field2Name: string;
  field3Status: CustomerFieldStatus;
  field3Name: string;
  field4Status: CustomerFieldStatus;
  field4Name: string;
};

export const PAYMENT_TERMS_OPTIONS = ['Credit', 'Payment by Credit Card or Paypal'] as const;

const EMPTY_FORM: CustomerFormState = {
  customerNumber: '',
  name: '',
  alias: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  paymentTerms: 'Credit',
  priorityErpNumber: '',
  hourlyRate: '0.00',
  sla: '1 day',
  travellingCharges: 'non_billable',
  remarks: '',
  isStenoCustomer: false,
  isAudioCustomer: false,
  isCaptionsCustomer: false,
  enabled: true,
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
  const [activeTab, setActiveTab] = useState<CustomerFormTab>('basic');
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (mode !== 'edit' || !customerId) return;

    let active = true;
    setLoading(true);
    setError('');
    setActiveTab('basic');

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
          paymentTerms: customer.paymentTerms || 'Credit',
          priorityErpNumber: customer.priorityErpNumber ?? '',
          hourlyRate: customer.hourlyRate.toFixed(2),
          sla: customer.sla,
          travellingCharges: customer.travellingCharges,
          remarks: customer.remarks,
          isStenoCustomer: customer.isStenoCustomer === true,
          isAudioCustomer: customer.isAudioCustomer === true,
          isCaptionsCustomer: customer.isCaptionsCustomer === true,
          enabled: customer.enabled !== false,
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
    if (form.isStenoCustomer) {
      if (!form.hourlyRate.trim() || Number.isNaN(Number.parseFloat(form.hourlyRate))) {
        return t('customerHourlyRateRequired');
      }
      if (!form.sla) return t('customerSlaRequired');
    }
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
    paymentTerms: form.paymentTerms.trim(),
    priorityErpNumber: form.priorityErpNumber.trim(),
    hourlyRate: Number.parseFloat(form.hourlyRate || '0'),
    sla: form.sla || '1 day',
    travellingCharges: form.travellingCharges,
    remarks: form.remarks.trim(),
    isStenoCustomer: form.isStenoCustomer,
    isAudioCustomer: form.isAudioCustomer,
    isCaptionsCustomer: form.isCaptionsCustomer,
    enabled: form.enabled,
    field1Status: form.field1Status,
    field1Name: form.field1Status === 'invisible' ? form.field1Name : form.field1Name.trim(),
    field2Status: form.field2Status,
    field2Name: form.field2Status === 'invisible' ? form.field2Name : form.field2Name.trim(),
    field3Status: form.field3Status,
    field3Name: form.field3Status === 'invisible' ? form.field3Name : form.field3Name.trim(),
    field4Status: form.field4Status,
    field4Name: form.field4Status === 'invisible' ? form.field4Name : form.field4Name.trim(),
  });

  const saveCustomer = async (next: 'close' | 'add-another') => {
    setError('');
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createCustomer(payload);
        if (next === 'add-another') {
          setForm(EMPTY_FORM);
          setFormKey((value) => value + 1);
          setActiveTab('basic');
          onSaved(t('customerCreatedSuccess'), 'add-another');
        } else {
          onSaved(t('customerCreatedSuccess'), 'close');
        }
      } else if (customerId) {
        await updateCustomer(customerId, payload);
        onSaved(t('customerUpdatedSuccess'), 'close');
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await saveCustomer('close');
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

  const paymentTermsOptions = Array.from(
    new Set([
      ...PAYMENT_TERMS_OPTIONS,
      ...(form.paymentTerms && !PAYMENT_TERMS_OPTIONS.includes(form.paymentTerms as never)
        ? [form.paymentTerms]
        : []),
    ]),
  );

  return (
    <div className="user-details-form customer-details-shell">
      <div className="profile-card customer-details-card">
        <form className="profile-form customer-details-form" onSubmit={handleSubmit} noValidate key={formKey}>
          <div className="customer-details-header">
            <h2>
              {mode === 'create' ? t('customerDetailsCreateTitle') : t('customerDetailsEditTitle')}
            </h2>
            <button type="button" className="customer-details-close" onClick={onCancel} aria-label={t('cancel')}>
              ×
            </button>
          </div>

          <div className="customer-form-tabs" role="tablist" aria-label={t('customers')}>
            {(
              [
                ['basic', t('customerTabBasicData')],
                ['steno', t('customerTabSteno')],
                ['audio', t('customerTabAudio')],
                ['captions', t('customerTabCaptions')],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`customer-form-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          {activeTab === 'basic' && (
            <div className="customer-tab-panel" role="tabpanel">
              <div className="profile-grid">
                <label className="profile-label" htmlFor="customer-name">
                  {t('name')}
                </label>
                <input
                  id="customer-name"
                  className="profile-input"
                  value={form.name}
                  placeholder={t('customerNamePlaceholder')}
                  onChange={(e) => updateField('name', e.target.value)}
                />

                <label className="profile-label" htmlFor="customer-alias">
                  {t('alias')}
                </label>
                <input
                  id="customer-alias"
                  className="profile-input"
                  value={form.alias}
                  placeholder={t('customerAliasPlaceholder')}
                  onChange={(e) => updateField('alias', e.target.value)}
                />

                <label className="profile-label" htmlFor="customer-contact-person">
                  {t('contactPerson')}
                </label>
                <input
                  id="customer-contact-person"
                  className="profile-input"
                  value={form.contactPerson}
                  placeholder={t('optionalPlaceholder')}
                  onChange={(e) => updateField('contactPerson', e.target.value)}
                />

                <label className="profile-label" htmlFor="customer-contact-phone">
                  {t('contactPhone')}
                </label>
                <input
                  id="customer-contact-phone"
                  className="profile-input"
                  value={form.contactPhone}
                  placeholder={t('optionalPlaceholder')}
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
                  placeholder={t('optionalPlaceholder')}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />

                <label className="profile-label" htmlFor="customer-priority-erp">
                  {t('priorityErpNumber')}
                </label>
                <input
                  id="customer-priority-erp"
                  className="profile-input"
                  value={form.priorityErpNumber}
                  placeholder={t('priorityErpNumberPlaceholder')}
                  onChange={(e) => updateField('priorityErpNumber', e.target.value)}
                />

                <label className="profile-label" htmlFor="customer-payment-terms">
                  {t('paymentTermsAgreed')}
                </label>
                <select
                  id="customer-payment-terms"
                  className="profile-input"
                  value={form.paymentTerms}
                  onChange={(e) => updateField('paymentTerms', e.target.value)}
                >
                  {paymentTermsOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
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
                  placeholder={t('optionalPlaceholder')}
                  onChange={(e) => updateField('remarks', e.target.value)}
                />

                <span className="profile-label" />
                <div className="customer-checkbox-group customer-basic-checks">
                  <label className="customer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isStenoCustomer}
                      onChange={(e) => updateField('isStenoCustomer', e.target.checked)}
                    />
                    {t('stenoCustomer')}
                  </label>
                  <label className="customer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isAudioCustomer}
                      onChange={(e) => updateField('isAudioCustomer', e.target.checked)}
                    />
                    {t('enableOrderingAudioTranscriptions')}
                  </label>
                  <label className="customer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isCaptionsCustomer}
                      onChange={(e) => updateField('isCaptionsCustomer', e.target.checked)}
                    />
                    {t('enableOrderingLiveCaptions')}
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'steno' && (
            <div className="customer-tab-panel" role="tabpanel">
              {!form.isStenoCustomer ? (
                <p className="profile-field-hint">{t('customerStenoTabDisabledHint')}</p>
              ) : (
                <>
                  <div className="profile-grid">
                    {mode === 'edit' && (
                      <>
                        <label className="profile-label">{t('customerNumber')}</label>
                        <input
                          className="profile-input profile-input-readonly"
                          value={form.customerNumber}
                          readOnly
                        />
                      </>
                    )}

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
                </>
              )}
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="customer-tab-panel" role="tabpanel">
              <p className="profile-field-hint">
                {form.isAudioCustomer
                  ? t('customerAudioTabEnabledHint')
                  : t('customerAudioTabDisabledHint')}
              </p>
            </div>
          )}

          {activeTab === 'captions' && (
            <div className="customer-tab-panel" role="tabpanel">
              <p className="profile-field-hint">
                {form.isCaptionsCustomer
                  ? t('customerCaptionsTabEnabledHint')
                  : t('customerCaptionsTabDisabledHint')}
              </p>
            </div>
          )}

          <div className="profile-actions customer-details-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="profile-submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
            {mode === 'create' && (
              <button
                type="button"
                className="profile-submit"
                disabled={saving}
                onClick={() => void saveCustomer('add-another')}
              >
                {saving ? t('saving') : t('saveAndAddNew')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
