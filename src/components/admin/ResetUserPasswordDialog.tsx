import { useState } from 'react';
import { resetUserPassword } from '../../api/profile';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface ResetUserPasswordDialogProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onReset: (message: string) => void;
}

function parseResetError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('userPasswordResetError');
}

export default function ResetUserPasswordDialog({
  userId,
  userName,
  onClose,
  onReset,
}: ResetUserPasswordDialogProps) {
  const { t } = useLanguage();
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleConfirm = async () => {
    setResetting(true);
    setError('');
    try {
      const result = await resetUserPassword(userId);
      setTemporaryPassword(result.temporaryPassword);
    } catch (err) {
      setError(parseResetError((err as Error).message, t));
    } finally {
      setResetting(false);
    }
  };

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleDone = () => {
    onReset(t('userPasswordResetSuccess'));
  };

  return (
    <div className="dialog-overlay" role="presentation" onClick={temporaryPassword ? undefined : onClose}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-user-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reset-user-password-title">{t('resetUserPasswordTitle')}</h2>

        {temporaryPassword ? (
          <>
            <p>{t('resetUserPasswordDoneMessage').replace('{name}', userName)}</p>
            <div className="profile-alert profile-alert-success">
              <div className="profile-field-hint">{t('temporaryPasswordLabel')}</div>
              <code className="reset-password-value">{temporaryPassword}</code>
            </div>
            <p className="profile-field-hint">{t('resetUserPasswordMustChangeHint')}</p>
            {error && <div className="profile-alert profile-alert-error">{error}</div>}
            <div className="dialog-actions">
              <button type="button" className="profile-cancel-btn" onClick={handleCopy}>
                {copied ? t('copied') : t('copyPassword')}
              </button>
              <button type="button" className="profile-submit" onClick={handleDone}>
                {t('close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{t('resetUserPasswordMessage').replace('{name}', userName)}</p>
            {error && <div className="profile-alert profile-alert-error">{error}</div>}
            <div className="dialog-actions">
              <button
                type="button"
                className="profile-cancel-btn"
                onClick={onClose}
                disabled={resetting}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="profile-submit"
                onClick={() => void handleConfirm()}
                disabled={resetting}
              >
                {resetting ? t('saving') : t('resetPassword')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
