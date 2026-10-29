import { useEffect, useState, type FormEvent } from 'react';
import { updateProfile, type UserProfile } from '../../api/profile';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { normalizeRoles } from '../../config/roles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AccountDetailsFormProps {
  profile: UserProfile;
  onSaved: (user: UserProfile, emailChanged: boolean) => void;
  onChangePassword: () => void;
}

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('profileSaveError');
}

export default function AccountDetailsForm({
  profile,
  onSaved,
  onChangePassword,
}: AccountDetailsFormProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [contactPhone, setContactPhone] = useState(profile.contactPhone);
  const [mobilePhone, setMobilePhone] = useState(profile.mobilePhone);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const isStenotypist = normalizeRoles(profile.roles ?? profile.role).includes('stenotypist');

  useEffect(() => {
    setFullName(profile.fullName);
    setUsername(profile.username);
    setEmail(profile.email);
    setContactPhone(profile.contactPhone);
    setMobilePhone(profile.mobilePhone);
    setError('');
    setSuccess('');
  }, [profile]);

  const validateClient = (): string | null => {
    if (!fullName.trim()) return t('fullNameRequired');
    if (!username.trim()) return t('usernameRequired');
    if (!email.trim()) return t('emailRequired');
    if (!EMAIL_PATTERN.test(email.trim())) return t('emailInvalid');
    if (isStenotypist && !mobilePhone.trim()) return t('mobilePhoneRequired');
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        contactPhone: contactPhone.trim(),
        mobilePhone: mobilePhone.trim(),
      });

      setSuccess(
        result.emailChanged ? t('accountEmailChangeSuccess') : t('accountSavedSuccess'),
      );
      onSaved(result.user, result.emailChanged);
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-form account-details-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="profile-alert profile-alert-error">{error}</div>}
      {success && <div className="profile-alert profile-alert-success">{success}</div>}

      <div className="profile-grid">
        <label className="profile-label" htmlFor="account-fullName">
          {t('fullName')} *
        </label>
        <input
          id="account-fullName"
          className="profile-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label className="profile-label" htmlFor="account-username">
          {t('alias')} *
        </label>
        <input
          id="account-username"
          className="profile-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="profile-label" htmlFor="account-email">
          {t('email')} *
        </label>
        <input
          id="account-email"
          type="email"
          className="profile-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label className="profile-label" htmlFor="account-contactPhone">
          {t('contactPhone')}
        </label>
        <input
          id="account-contactPhone"
          className="profile-input"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <label className="profile-label" htmlFor="account-mobilePhone">
          {t('mobilePhone')}
          {isStenotypist ? ' *' : ''}
        </label>
        <input
          id="account-mobilePhone"
          className="profile-input"
          value={mobilePhone}
          onChange={(e) => setMobilePhone(e.target.value)}
        />
        {isStenotypist && (
          <p className="profile-field-hint profile-grid-span">{t('mobilePhoneStenotypistHint')}</p>
        )}
      </div>

      <div className="profile-actions account-details-actions">
        <button type="button" className="profile-link-btn" onClick={onChangePassword}>
          {t('changePassword')}
        </button>
        <button type="submit" className="profile-submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
