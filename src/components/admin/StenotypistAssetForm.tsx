import { useEffect, useState, type FormEvent } from 'react';
import {
  createStenotypistAsset,
  fetchStenotypistAssetById,
  updateStenotypistAsset,
  type StenotypistAssetPayload,
} from '../../api/stenotypistAssets';
import { fetchUsers, type UserProfile } from '../../api/profile';
import { normalizeRoles } from '../../config/roles';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface StenotypistAssetFormProps {
  mode: 'create' | 'edit';
  assetId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

const EMPTY_FORM: StenotypistAssetPayload = {
  stenotypistId: '',
  laptopSerialNumber: '',
  stenotypeMachineSerialNumber: '',
  catalystProductKey: '',
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
  return t('stenotypistAssetSaveError');
}

export default function StenotypistAssetForm({
  mode,
  assetId,
  onCancel,
  onSaved,
}: StenotypistAssetFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stenotypists, setStenotypists] = useState<UserProfile[]>([]);
  const [form, setForm] = useState<StenotypistAssetPayload>(EMPTY_FORM);

  useEffect(() => {
    let active = true;

    fetchUsers()
      .then((users) => {
        if (!active) return;
        setStenotypists(
          users.filter((user) => normalizeRoles(user.roles ?? user.role).includes('stenotypist')),
        );
      })
      .catch(() => {
        if (active) setError(t('profileLoadError'));
      });

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !assetId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchStenotypistAssetById(assetId)
      .then((asset) => {
        if (!active) return;
        setForm({
          stenotypistId: asset.stenotypistId,
          laptopSerialNumber: asset.laptopSerialNumber,
          stenotypeMachineSerialNumber: asset.stenotypeMachineSerialNumber,
          catalystProductKey: asset.catalystProductKey,
        });
      })
      .catch(() => {
        if (active) setError(t('stenotypistAssetLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, assetId, t]);

  const validateClient = (): string | null => {
    if (!form.stenotypistId.trim()) return t('stenotypistRequired');
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
        stenotypistId: form.stenotypistId.trim(),
        laptopSerialNumber: form.laptopSerialNumber.trim(),
        stenotypeMachineSerialNumber: form.stenotypeMachineSerialNumber.trim(),
        catalystProductKey: form.catalystProductKey.trim(),
      };

      if (mode === 'create') {
        await createStenotypistAsset(payload);
        onSaved(t('stenotypistAssetCreatedSuccess'));
      } else if (assetId) {
        await updateStenotypistAsset(assetId, payload);
        onSaved(t('stenotypistAssetUpdatedSuccess'));
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
              {mode === 'create' ? t('stenotypistAssetCreateTitle') : t('stenotypistAssetEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="asset-stenotypist">
              {t('stenotypist')} *
            </label>
            <select
              id="asset-stenotypist"
              className="profile-input"
              value={form.stenotypistId}
              onChange={(e) =>
                setForm((current) => ({ ...current, stenotypistId: e.target.value }))
              }
              disabled={mode === 'edit'}
            >
              <option value="">{t('selectStenotypist')}</option>
              {stenotypists.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.username})
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="asset-laptop-serial">
              {t('laptopSerialNumber')}
            </label>
            <input
              id="asset-laptop-serial"
              className="profile-input"
              value={form.laptopSerialNumber}
              onChange={(e) =>
                setForm((current) => ({ ...current, laptopSerialNumber: e.target.value }))
              }
            />

            <label className="profile-label" htmlFor="asset-machine-serial">
              {t('stenotypeMachineSerialNumber')}
            </label>
            <input
              id="asset-machine-serial"
              className="profile-input"
              value={form.stenotypeMachineSerialNumber}
              onChange={(e) =>
                setForm((current) => ({ ...current, stenotypeMachineSerialNumber: e.target.value }))
              }
            />

            <label className="profile-label" htmlFor="asset-catalyst-key">
              {t('catalystProductKey')}
            </label>
            <input
              id="asset-catalyst-key"
              className="profile-input"
              value={form.catalystProductKey}
              onChange={(e) =>
                setForm((current) => ({ ...current, catalystProductKey: e.target.value }))
              }
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
