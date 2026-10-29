import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, updateProfile, type UserProfile } from '../api/profile';
import { getRoleDescriptionKey, formatRoleLabels } from '../config/roles';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/translations';
import { updateStoredUser } from '../utils/auth';
import '../styles/profile.css';

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fullName, setFullName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [profileLanguage, setProfileLanguage] = useState<Language>('en');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    let active = true;

    fetchProfile()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setFullName(data.fullName);
        setContactPhone(data.contactPhone);
        setMobilePhone(data.mobilePhone);
        setProfileLanguage(data.language);
        setAutoRefresh(data.autoRefresh);
      })
      .catch(() => {
        if (active) setError(t('profileLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const result = await updateProfile({
        fullName: fullName.trim(),
        contactPhone: contactPhone.trim(),
        mobilePhone: mobilePhone.trim(),
        language: profileLanguage,
        autoRefresh,
      });

      const updated = result.user;
      setProfile(updated);
      updateStoredUser(updated);
      setLanguage(updated.language);
      setSuccess(t('profileSaved'));
    } catch {
      setError(t('profileSaveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('myProfile')}</h1>
          <p className="page-subtitle">{t('profileSubtitle')}</p>
        </div>
      </div>

      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit}>
          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="fullName">
              {t('fullName')}
            </label>
            <input
              id="fullName"
              className="profile-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <label className="profile-label" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              className="profile-input profile-input-readonly"
              value={profile?.email ?? ''}
              readOnly
              title={t('emailReadOnlyHint')}
            />

            <label className="profile-label" htmlFor="username">
              {t('username')}
            </label>
            <input
              id="username"
              className="profile-input profile-input-readonly"
              value={profile?.username ?? ''}
              readOnly
              title={t('usernameReadOnlyHint')}
            />

            <label className="profile-label" htmlFor="role">
              {t('role')}
            </label>
            <input
              id="role"
              className="profile-input profile-input-readonly"
              value={profile ? formatRoleLabels(profile.roles ?? profile.role, t) : ''}
              readOnly
              title={t('roleReadOnlyHint')}
            />
            {profile &&
              (profile.roles ?? [profile.role]).map((role) => {
                const descriptionKey = getRoleDescriptionKey(role);
                return descriptionKey ? (
                  <p key={role} className="profile-role-description">
                    {t(descriptionKey)}
                  </p>
                ) : null;
              })}

            <label className="profile-label" htmlFor="status">
              {t('status')}
            </label>
            <div>
              <span
                id="status"
                className={`profile-status-badge profile-status-${profile?.status ?? 'active'}`}
              >
                {profile?.status === 'inactive' ? t('statusInactive') : t('statusActive')}
              </span>
            </div>

            <label className="profile-label" htmlFor="customer">
              {t('customer')}
            </label>
            <input
              id="customer"
              className="profile-input profile-input-readonly"
              value={profile?.customerName ?? t('optional')}
              readOnly
              title={t('customerReadOnlyHint')}
            />

            <label className="profile-label" htmlFor="contactPhone">
              {t('contactPhone')}
            </label>
            <input
              id="contactPhone"
              className="profile-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t('optional')}
            />

            <label className="profile-label" htmlFor="mobilePhone">
              {t('mobilePhone')}
            </label>
            <input
              id="mobilePhone"
              className="profile-input"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
            />

            <label className="profile-label" htmlFor="language">
              {t('language')}
            </label>
            <select
              id="language"
              className="profile-input"
              value={profileLanguage}
              onChange={(e) => setProfileLanguage(e.target.value as Language)}
            >
              <option value="en">{t('english')}</option>
              <option value="el">{t('greek')}</option>
            </select>

            <label className="profile-label" htmlFor="autoRefresh">
              {t('autoRefresh')}
            </label>
            <select
              id="autoRefresh"
              className="profile-input"
              value={autoRefresh ? 'on' : 'off'}
              onChange={(e) => setAutoRefresh(e.target.value === 'on')}
            >
              <option value="off">{t('off')}</option>
              <option value="on">{t('on')}</option>
            </select>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="profile-link-btn"
              onClick={() => navigate('/administration/account-management?section=change-password')}
            >
              {t('changePassword')}
            </button>
            <button type="submit" className="profile-submit" disabled={saving}>
              {saving ? t('saving') : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
