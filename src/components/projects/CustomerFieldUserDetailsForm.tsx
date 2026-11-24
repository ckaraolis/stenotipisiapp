import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchCustomerFieldValues } from '../../api/customers';
import {
  createCustomerFieldUserMapping,
  fetchCustomerFieldUserMappingById,
  fetchCustomerFieldUserOptions,
  updateCustomerFieldUserMapping,
} from '../../api/customerFieldsToUsers';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import type { CustomerFieldValue } from '../../types/customer';
import type {
  CustomerFieldUserOption,
  CustomerFieldUserPayload,
} from '../../types/customerFieldUser';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface CustomerFieldUserDetailsFormProps {
  mode: 'create' | 'edit';
  mappingId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type FormState = {
  customerId: string;
  fieldName: string;
  fieldValue: string;
  userIds: string[];
  validityFrom: string;
};

const EMPTY_FORM: FormState = {
  customerId: '',
  fieldName: '',
  fieldValue: '',
  userIds: [],
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
  return t('customerFieldUserSaveError');
}

export default function CustomerFieldUserDetailsForm({
  mode,
  mappingId,
  onCancel,
  onSaved,
}: CustomerFieldUserDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [users, setUsers] = useState<CustomerFieldUserOption[]>([]);
  const [fieldValues, setFieldValues] = useState<CustomerFieldValue[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchCustomerFieldUserOptions()])
      .then(([customerRows, userRows]) => {
        if (!active) return;
        setCustomers([...customerRows].sort((a, b) => a.name.localeCompare(b.name)));
        setUsers(userRows);
      })
      .catch(() => {
        if (active) setError(t('customerFieldUserOptionsLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !mappingId) return;
    let active = true;
    setLoading(true);
    setError('');
    fetchCustomerFieldUserMappingById(mappingId)
      .then((mapping) => {
        if (!active) return;
        setForm({
          customerId: mapping.customerId,
          fieldName: mapping.fieldName,
          fieldValue: mapping.fieldValue,
          userIds: mapping.userIds,
          validityFrom: mapping.validityFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('customerFieldUserLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, mappingId, t]);

  useEffect(() => {
    if (!form.customerId) {
      setFieldValues([]);
      return;
    }
    let active = true;
    fetchCustomerFieldValues(form.customerId, 2)
      .then((values) => {
        if (active) setFieldValues(values);
      })
      .catch(() => {
        if (active) setFieldValues([]);
      });
    return () => {
      active = false;
    };
  }, [form.customerId]);

  const fieldValueOptions = useMemo(() => {
    const values = fieldValues.map((entry) => entry.value);
    if (form.fieldValue && !values.includes(form.fieldValue)) {
      return [form.fieldValue, ...values];
    }
    return values;
  }, [fieldValues, form.fieldValue]);

  const validateClient = (): string | null => {
    if (!form.customerId) return t('customerFieldUserCustomerRequired');
    if (!form.fieldValue.trim()) return t('customerFieldUserFieldValueRequired');
    if (form.userIds.length === 0) return t('customerFieldUserUsersRequired');
    if (!form.validityFrom.trim()) return t('customerFieldUserValidityFromRequired');
    return null;
  };

  const buildPayload = (): CustomerFieldUserPayload => ({
    customerId: form.customerId,
    fieldName: form.fieldName.trim(),
    fieldValue: form.fieldValue.trim(),
    userIds: form.userIds,
    validityFrom: form.validityFrom.trim(),
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
        await createCustomerFieldUserMapping(payload);
        onSaved(t('customerFieldUserCreatedSuccess'));
      } else if (mappingId) {
        await updateCustomerFieldUserMapping(mappingId, payload);
        onSaved(t('customerFieldUserUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleUser = (userId: string) => {
    setForm((current) => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter((id) => id !== userId)
        : [...current.userIds, userId],
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
              {mode === 'create'
                ? t('customerFieldUserDetailsCreateTitle')
                : t('customerFieldUserDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="cfu-customer">
              {t('customer')} *
            </label>
            <select
              id="cfu-customer"
              className="profile-input"
              value={form.customerId}
              onChange={(event) => {
                updateField('customerId', event.target.value);
                updateField('fieldValue', '');
              }}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="cfu-field-name">
              {t('fieldName')}
            </label>
            <input
              id="cfu-field-name"
              className="profile-input"
              value={form.fieldName}
              onChange={(event) => updateField('fieldName', event.target.value)}
            />

            <label className="profile-label" htmlFor="cfu-field-value">
              {t('fieldValue')} *
            </label>
            <input
              id="cfu-field-value"
              className="profile-input"
              list="cfu-field-value-options"
              value={form.fieldValue}
              onChange={(event) => updateField('fieldValue', event.target.value)}
            />
            <datalist id="cfu-field-value-options">
              {fieldValueOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            <label className="profile-label" htmlFor="cfu-validity-from">
              {t('validityFrom')} *
            </label>
            <input
              id="cfu-validity-from"
              type="date"
              className="profile-input"
              value={form.validityFrom}
              onChange={(event) => updateField('validityFrom', event.target.value)}
            />

            <span className="profile-label">{t('users')} *</span>
            <div className="customer-field-user-checklist">
              {users.length === 0 ? (
                <span className="profile-field-hint">{t('noRecordsFound')}</span>
              ) : (
                users.map((user) => (
                  <label key={user.id} className="customer-field-user-check">
                    <input
                      type="checkbox"
                      checked={form.userIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    <span>
                      {user.username}
                      {user.fullName ? ` — ${user.fullName}` : ''}
                    </span>
                  </label>
                ))
              )}
            </div>
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
    </div>
  );
}
