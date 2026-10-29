import { useEffect, useState, type FormEvent } from 'react';
import {
  createPublicHoliday,
  fetchPublicHolidayById,
  updatePublicHoliday,
} from '../../api/publicHolidays';
import type { PublicHolidayPayload } from '../../types/publicHoliday';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface PublicHolidayDetailsFormProps {
  mode: 'create' | 'edit';
  holidayId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type PublicHolidayFormState = {
  name: string;
  date: string;
};

const EMPTY_FORM: PublicHolidayFormState = {
  name: '',
  date: '',
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
  return t('publicHolidaySaveError');
}

export default function PublicHolidayDetailsForm({
  mode,
  holidayId,
  onCancel,
  onSaved,
}: PublicHolidayDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PublicHolidayFormState>(EMPTY_FORM);

  useEffect(() => {
    if (mode !== 'edit' || !holidayId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchPublicHolidayById(holidayId)
      .then((holiday) => {
        if (!active) return;
        setForm({
          name: holiday.name,
          date: holiday.date,
        });
      })
      .catch(() => {
        if (active) setError(t('publicHolidayLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, holidayId, t]);

  const validateClient = (): string | null => {
    if (!form.name.trim()) return t('publicHolidayNameRequired');
    if (!form.date.trim()) return t('publicHolidayDateRequired');
    return null;
  };

  const buildPayload = (): PublicHolidayPayload => ({
    name: form.name.trim(),
    date: form.date.trim(),
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
        await createPublicHoliday(payload);
        onSaved(t('publicHolidayCreatedSuccess'));
      } else if (holidayId) {
        await updatePublicHoliday(holidayId, payload);
        onSaved(t('publicHolidayUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof PublicHolidayFormState>(
    key: K,
    value: PublicHolidayFormState[K],
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
                ? t('publicHolidayDetailsCreateTitle')
                : t('publicHolidayDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="public-holiday-name">
              {t('holidayName')} *
            </label>
            <input
              id="public-holiday-name"
              className="profile-input"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />

            <label className="profile-label" htmlFor="public-holiday-date">
              {t('holidayDate')} *
            </label>
            <input
              id="public-holiday-date"
              type="date"
              className="profile-input"
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
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
