import { useState, type FormEvent } from 'react';
import { changePassword } from '../../api/profile';
import { resetPasswordWithToken } from '../../api/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import { parsePasswordErrors } from '../../utils/passwordErrors';
import { validatePasswordPolicy } from '../../config/passwordPolicy';
import type { UserProfile } from '../../api/profile';

export type ChangePasswordFormMode = 'account' | 'enforced' | 'reset';

interface ChangePasswordFormProps {
  mode: ChangePasswordFormMode;
  resetToken?: string;
  userEmail?: string;
  onSuccess?: (user?: UserProfile) => void;
}

export default function ChangePasswordForm({
  mode,
  resetToken,
  userEmail,
  onSuccess,
}: ChangePasswordFormProps) {
  const { t } = useLanguage();
  const requireCurrentPassword = mode !== 'reset';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (requireCurrentPassword && !currentPassword.trim()) {
      setError(t('currentPasswordRequired'));
      return;
    }
    if (!newPassword.trim()) {
      setError(t('newPasswordRequired'));
      return;
    }
    if (!confirmPassword.trim()) {
      setError(t('confirmPasswordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    if (requireCurrentPassword && newPassword === currentPassword) {
      setError(t('newPasswordMustDiffer'));
      return;
    }

    const policyErrors = validatePasswordPolicy(newPassword);
    if (policyErrors.length > 0) {
      setError(policyErrors.map((key) => t(key)).join(' '));
      return;
    }

    setSaving(true);
    try {
      if (mode === 'reset') {
        if (!resetToken) {
          setError(t('resetTokenInvalid'));
          return;
        }
        await resetPasswordWithToken({ token: resetToken, newPassword });
        setSuccess(t('passwordResetSuccess'));
        onSuccess?.();
      } else {
        const updated = await changePassword({ currentPassword, newPassword });
        setSuccess(t('passwordChangedSuccess'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onSuccess?.(updated);
      }
    } catch (err) {
      setError(parsePasswordErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="account-password-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="profile-alert profile-alert-error">{error}</div>}
      {success && <div className="profile-alert profile-alert-success">{success}</div>}

      {userEmail && mode === 'reset' && (
        <p className="profile-field-hint account-password-email">{userEmail}</p>
      )}

      {requireCurrentPassword && (
        <>
          <label className="profile-label" htmlFor="current-password">
            {t('currentPassword')} *
          </label>
          <input
            id="current-password"
            type="password"
            className="profile-input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </>
      )}

      <label className="profile-label" htmlFor="new-password">
        {t('newPassword')} *
      </label>
      <input
        id="new-password"
        type="password"
        className="profile-input"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <p className="profile-field-hint">{t('passwordPolicyRequirements')}</p>

      <label className="profile-label" htmlFor="confirm-password">
        {t('confirmPassword')} *
      </label>
      <input
        id="confirm-password"
        type="password"
        className="profile-input"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <div className="profile-actions account-password-actions">
        <button type="submit" className="profile-submit" disabled={saving}>
          {saving ? t('saving') : t('changePassword')}
        </button>
      </div>
    </form>
  );
}
