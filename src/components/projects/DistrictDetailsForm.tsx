import { useEffect, useState, type FormEvent } from 'react';
import { createDistrict, fetchDistrictById, updateDistrict } from '../../api/districts';
import type { DistrictPayload } from '../../types/district';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface DistrictDetailsFormProps {
  mode: 'create' | 'edit';
  districtId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type DistrictFormState = {
  name: string;
  alias: string;
};

const EMPTY_FORM: DistrictFormState = {
  name: '',
  alias: '',
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
  return t('districtSaveError');
}

export default function DistrictDetailsForm({
  mode,
  districtId,
  onCancel,
  onSaved,
}: DistrictDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<DistrictFormState>(EMPTY_FORM);

  useEffect(() => {
    if (mode !== 'edit' || !districtId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchDistrictById(districtId)
      .then((district) => {
        if (!active) return;
        setForm({
          name: district.name,
          alias: district.alias,
        });
      })
      .catch(() => {
        if (active) setError(t('districtLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, districtId, t]);

  const validateClient = (): string | null => {
    if (!form.name.trim()) return t('districtNameRequired');
    if (!form.alias.trim()) return t('districtAliasRequired');
    return null;
  };

  const buildPayload = (): DistrictPayload => ({
    name: form.name.trim(),
    alias: form.alias.trim().toUpperCase(),
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
        await createDistrict(payload);
        onSaved(t('districtCreatedSuccess'));
      } else if (districtId) {
        await updateDistrict(districtId, payload);
        onSaved(t('districtUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof DistrictFormState>(key: K, value: DistrictFormState[K]) => {
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
              {mode === 'create' ? t('districtDetailsCreateTitle') : t('districtDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="district-name">
              {t('districtName')} *
            </label>
            <input
              id="district-name"
              className="profile-input"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />

            <label className="profile-label" htmlFor="district-alias">
              {t('districtAlias')} *
            </label>
            <input
              id="district-alias"
              className="profile-input"
              value={form.alias}
              onChange={(event) => updateField('alias', event.target.value.toUpperCase())}
            />
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
