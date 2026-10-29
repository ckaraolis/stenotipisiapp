import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createCustomerFieldValue,
  updateCustomerFieldValue,
} from '../../api/customers';
import type { CustomerFieldValue, CustomerRecord } from '../../types/customer';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface CustomerFieldConfigurationFormProps {
  mode: 'create' | 'edit';
  customer: CustomerRecord;
  fieldValueId?: string;
  initialFieldReference?: 1 | 2;
  initialValue?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type FieldOption = {
  fieldReference: 1 | 2;
  label: string;
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
  return t('customerFieldOptionsSaveError');
}

function getFieldOptions(customer: CustomerRecord): FieldOption[] {
  const options: FieldOption[] = [];

  if (customer.field1Status !== 'invisible' && customer.field1Name.trim()) {
    options.push({ fieldReference: 1, label: customer.field1Name.trim() });
  }

  if (customer.field2Status !== 'invisible' && customer.field2Name.trim()) {
    options.push({ fieldReference: 2, label: customer.field2Name.trim() });
  }

  return options;
}

function getFieldLabel(customer: CustomerRecord, fieldReference: 1 | 2): string {
  return fieldReference === 1 ? customer.field1Name : customer.field2Name;
}

export default function CustomerFieldConfigurationForm({
  mode,
  customer,
  fieldValueId,
  initialFieldReference,
  initialValue = '',
  onCancel,
  onSaved,
}: CustomerFieldConfigurationFormProps) {
  const { t } = useLanguage();
  const [fieldReference, setFieldReference] = useState<1 | 2 | ''>(initialFieldReference ?? '');
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fieldOptions = useMemo(() => getFieldOptions(customer), [customer]);

  useEffect(() => {
    if (mode === 'create' && !fieldReference && fieldOptions.length === 1) {
      setFieldReference(fieldOptions[0].fieldReference);
    }
  }, [mode, fieldReference, fieldOptions]);

  const validateClient = (): string | null => {
    if (!fieldReference) return t('customerFieldNameRequired');
    if (!value.trim()) return t('customerFieldValueRequired');
    return null;
  };

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
      const payload = {
        fieldReference: fieldReference as 1 | 2,
        value: value.trim(),
      };

      if (mode === 'create') {
        await createCustomerFieldValue(customer.id, payload);
        onSaved(t('customerFieldValueCreatedSuccess'));
      } else if (fieldValueId) {
        await updateCustomerFieldValue(customer.id, fieldValueId, payload);
        onSaved(t('customerFieldValueUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldLabel =
    fieldReference === 1 || fieldReference === 2
      ? getFieldLabel(customer, fieldReference)
      : '';

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create'
                ? t('customerFieldConfigurationCreateTitle')
                : t('customerFieldConfigurationEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="customer-field-config-customer-name">
              {t('customer')}
            </label>
            <input
              id="customer-field-config-customer-name"
              className="profile-input profile-input-readonly"
              value={customer.name}
              readOnly
            />

            <label className="profile-label" htmlFor="customer-field-config-field-name">
              {t('fieldName')} *
            </label>
            {mode === 'create' ? (
              <select
                id="customer-field-config-field-name"
                className="profile-input"
                value={fieldReference}
                onChange={(e) => setFieldReference(e.target.value ? (Number(e.target.value) as 1 | 2) : '')}
              >
                <option value="">{t('selectOption')}</option>
                {fieldOptions.map((option) => (
                  <option key={option.fieldReference} value={option.fieldReference}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="customer-field-config-field-name"
                className="profile-input profile-input-readonly"
                value={selectedFieldLabel}
                readOnly
              />
            )}

            <label className="profile-label" htmlFor="customer-field-config-value">
              {t('fieldValue')} *
            </label>
            <input
              id="customer-field-config-value"
              className="profile-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel}>
              {t('cancel')}
            </button>
            <button type="submit" className="profile-submit" disabled={saving || fieldOptions.length === 0}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
