import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';
import { EMAIL_PATTERN } from '../utils/auth';
import { useLanguage } from '../i18n/LanguageContext';
import '../styles/signin.css';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('emailRequired'));
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSuccess(t('forgotPasswordSuccess'));
    } catch {
      setError(t('forgotPasswordError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page change-password-page">
      <section className="signin-form-panel change-password-panel">
        <div className="signin-card">
          <div className="signin-card-header">
            <h2 className="signin-title">{t('forgotPasswordTitle')}</h2>
            <p className="signin-subtitle">{t('forgotPasswordSubtitle')}</p>
          </div>

          <form className="signin-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="signin-error">{error}</div>}
            {success && <div className="signin-error signin-success">{success}</div>}

            <label className="signin-label" htmlFor="reset-email">
              {t('emailAddress')}
            </label>
            <div className="signin-field">
              <input
                id="reset-email"
                type="email"
                autoComplete="username"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button type="submit" className="signin-submit" disabled={loading}>
              {loading ? t('loading') : t('sendResetLink')}
            </button>
          </form>

          <div className="signin-footer">
            <Link to="/signin" className="signin-forgot">
              {t('mfaBack')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
