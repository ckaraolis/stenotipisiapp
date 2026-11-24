import { useEffect, useState, type FormEvent } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  createProjectType,
  fetchProjectTypeById,
  updateProjectType,
} from '../../api/projectTypes';
import type { ProjectTypePayload } from '../../types/projectType';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface ProjectTypeDetailsFormProps {
  mode: 'create' | 'edit';
  projectTypeId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type ProjectTypeFormState = {
  customerId: string;
  type: string;
  alias: string;
  transcriptText: string;
  enabled: boolean;
};

const EMPTY_FORM: ProjectTypeFormState = {
  customerId: '',
  type: '',
  alias: '',
  transcriptText: '',
  enabled: true,
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
  return t('projectTypeSaveError');
}

export default function ProjectTypeDetailsForm({
  mode,
  projectTypeId,
  onCancel,
  onSaved,
}: ProjectTypeDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState<ProjectTypeFormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    fetchCustomers()
      .then((rows) => {
        if (!active) return;
        setCustomers([...rows].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (active) setError(t('projectTypeCustomersLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !projectTypeId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchProjectTypeById(projectTypeId)
      .then((projectType) => {
        if (!active) return;
        setForm({
          customerId: projectType.customerId,
          type: projectType.type,
          alias: projectType.alias,
          transcriptText: projectType.transcriptText ?? '',
          enabled: projectType.enabled !== false,
        });
      })
      .catch(() => {
        if (active) setError(t('projectTypeLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, projectTypeId, t]);

  const validateClient = (): string | null => {
    if (!form.customerId) return t('projectTypeCustomerRequired');
    if (!form.type.trim()) return t('projectTypeTypeRequired');
    if (!form.alias.trim()) return t('projectTypeAliasRequired');
    return null;
  };

  const buildPayload = (): ProjectTypePayload => ({
    customerId: form.customerId,
    type: form.type.trim(),
    alias: form.alias.trim(),
    transcriptText: form.transcriptText.trim(),
    enabled: form.enabled,
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
        await createProjectType(payload);
        onSaved(t('projectTypeCreatedSuccess'));
      } else if (projectTypeId) {
        await updateProjectType(projectTypeId, payload);
        onSaved(t('projectTypeUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ProjectTypeFormState>(
    key: K,
    value: ProjectTypeFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
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
                ? t('projectTypeDetailsCreateTitle')
                : t('projectTypeDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="project-type-customer">
              {t('customer')} *
            </label>
            <select
              id="project-type-customer"
              className="profile-input"
              value={form.customerId}
              onChange={(event) => updateField('customerId', event.target.value)}
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="project-type-type">
              {t('type')} *
            </label>
            <input
              id="project-type-type"
              className="profile-input"
              value={form.type}
              onChange={(event) => updateField('type', event.target.value)}
            />

            <label className="profile-label" htmlFor="project-type-alias">
              {t('alias')} *
            </label>
            <input
              id="project-type-alias"
              className="profile-input"
              value={form.alias}
              onChange={(event) => updateField('alias', event.target.value)}
            />

            <label className="profile-label" htmlFor="project-type-transcript-text">
              {t('transcriptText')}
            </label>
            <input
              id="project-type-transcript-text"
              className="profile-input"
              value={form.transcriptText}
              onChange={(event) => updateField('transcriptText', event.target.value)}
            />

            <label className="profile-label" htmlFor="project-type-status">
              {t('status')}
            </label>
            <select
              id="project-type-status"
              className="profile-input"
              value={form.enabled ? 'enabled' : 'disabled'}
              onChange={(event) => updateField('enabled', event.target.value === 'enabled')}
            >
              <option value="enabled">{t('enabled')}</option>
              <option value="disabled">{t('disabled')}</option>
            </select>
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
