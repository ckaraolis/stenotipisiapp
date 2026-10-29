import { useEffect, useState, type FormEvent } from 'react';
import { fetchDistrictOptions } from '../../api/districts';
import {
  createTravellingTime,
  fetchTravellingTimeById,
  updateTravellingTime,
} from '../../api/travellingTimes';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type { TravellingTimePayload } from '../../types/travellingTime';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface TravellingTimeDetailsFormProps {
  mode: 'create' | 'edit';
  tripId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type TravellingTimeFormState = {
  district1Id: string;
  district2Id: string;
  travellingTime: string;
  validityFrom: string;
};

const EMPTY_FORM: TravellingTimeFormState = {
  district1Id: '',
  district2Id: '',
  travellingTime: '',
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
  return t('travellingTimeSaveError');
}

function formatDistrictOptionLabel(district: DistrictOption): string {
  return formatDistrictLabel({
    districtName: district.name,
    districtAlias: district.alias,
  });
}

export default function TravellingTimeDetailsForm({
  mode,
  tripId,
  onCancel,
  onSaved,
}: TravellingTimeDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [form, setForm] = useState<TravellingTimeFormState>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    fetchDistrictOptions()
      .then((options) => {
        if (active) setDistricts(options);
      })
      .catch(() => {
        if (active) setError(t('districtsLoadError'));
      });

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !tripId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchTravellingTimeById(tripId)
      .then((trip) => {
        if (!active) return;
        setForm({
          district1Id: trip.district1Id,
          district2Id: trip.district2Id,
          travellingTime: String(trip.travellingTime),
          validityFrom: trip.validityFrom,
        });
      })
      .catch(() => {
        if (active) setError(t('travellingTimeLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, tripId, t]);

  const validateClient = (): string | null => {
    if (!form.district1Id.trim()) return t('travellingTimeDistrict1Required');
    if (!form.district2Id.trim()) return t('travellingTimeDistrict2Required');
    if (form.district1Id === form.district2Id) return t('travellingTimeDistrictsMustDiffer');

    const minutes = Number(form.travellingTime);
    if (
      form.travellingTime.trim() === '' ||
      !Number.isFinite(minutes) ||
      !Number.isInteger(minutes) ||
      minutes < 0
    ) {
      return t('travellingTimeMinutesRequired');
    }

    if (!form.validityFrom.trim()) return t('travellingTimeValidityFromRequired');
    return null;
  };

  const buildPayload = (): TravellingTimePayload => ({
    district1Id: form.district1Id.trim(),
    district2Id: form.district2Id.trim(),
    travellingTime: Number(form.travellingTime),
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
        await createTravellingTime(payload);
        onSaved(t('travellingTimeCreatedSuccess'));
      } else if (tripId) {
        await updateTravellingTime(tripId, payload);
        onSaved(t('travellingTimeUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TravellingTimeFormState>(
    key: K,
    value: TravellingTimeFormState[K],
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
                ? t('travellingTimeDetailsCreateTitle')
                : t('travellingTimeDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="travelling-time-district-1">
              {t('district1')} *
            </label>
            <select
              id="travelling-time-district-1"
              className="profile-input"
              value={form.district1Id}
              onChange={(event) => updateField('district1Id', event.target.value)}
            >
              <option value="">{t('selectOption')}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {formatDistrictOptionLabel(district)}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="travelling-time-district-2">
              {t('district2')} *
            </label>
            <select
              id="travelling-time-district-2"
              className="profile-input"
              value={form.district2Id}
              onChange={(event) => updateField('district2Id', event.target.value)}
            >
              <option value="">{t('selectOption')}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {formatDistrictOptionLabel(district)}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="travelling-time-minutes">
              {t('travellingTimeMinutes')} *
            </label>
            <input
              id="travelling-time-minutes"
              type="number"
              min={0}
              step={1}
              className="profile-input"
              value={form.travellingTime}
              onChange={(event) => updateField('travellingTime', event.target.value)}
            />

            <label className="profile-label" htmlFor="travelling-time-validity-from">
              {t('validityFrom')} *
            </label>
            <input
              id="travelling-time-validity-from"
              type="date"
              className="profile-input"
              value={form.validityFrom}
              onChange={(event) => updateField('validityFrom', event.target.value)}
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
