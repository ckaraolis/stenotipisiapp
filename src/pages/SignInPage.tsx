import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import {
  AuthError,
  type AuthErrorCode,
  getPostLoginPath,
  getRememberedEmail,
  persistRememberMe,
  signIn,
  validateLoginCredentials,
  verifyMfa,
} from '../utils/auth';
import '../styles/signin.css';

type SignInStep = 'credentials' | 'mfa';

function getAuthErrorMessage(error: unknown, t: (key: TranslationKey) => string): string {
  if (error instanceof AuthError) {
    const messageKeys: Record<AuthErrorCode, TranslationKey> = {
      emailRequired: 'emailRequired',
      emailInvalid: 'emailInvalid',
      passwordRequired: 'passwordRequired',
      invalidCredentials: 'invalidCredentials',
      accountInactive: 'accountInactive',
      invalidMfaCode: 'invalidMfaCode',
    };
    return t(messageKeys[error.code]);
  }
  return t('invalidCredentials');
}

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState<SignInStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedEmail = getRememberedEmail();
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const state = location.state as {
      sessionExpired?: boolean;
      passwordResetComplete?: boolean;
    } | null;
    if (state?.sessionExpired) {
      setError(t('sessionExpired'));
      navigate(location.pathname, { replace: true, state: null });
    } else if (state?.passwordResetComplete) {
      setError('');
      setSuccess(t('passwordResetComplete'));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, t]);

  const handleCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const validationError = validateLoginCredentials(email, password);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const challenge = await signIn(trimmedEmail, password);
      setMfaToken(challenge.mfaToken);
      setEmail(challenge.email);
      setMfaCode('');
      setStep('mfa');
    } catch (err) {
      setError(getAuthErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const normalizedCode = mfaCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError(t('invalidMfaCode'));
      return;
    }

    setLoading(true);
    try {
      const user = await verifyMfa(mfaToken, normalizedCode);
      persistRememberMe(email, rememberMe);
      navigate(getPostLoginPath(user));
    } catch (err) {
      setError(getAuthErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setMfaToken('');
    setMfaCode('');
    setError('');
  };

  return (
    <div className="signin-page">
      <aside className="signin-brand-panel">
        <div className="signin-brand-content">
          <p className="signin-brand-welcome">{t('signInBrandWelcome')}</p>
          <img
            className="signin-brand-logo"
            src="/stenotyping-logo.jpg"
            alt="Stenotyping by Galatariotis"
          />
        </div>
      </aside>

      <section className="signin-form-panel">
        <div className="signin-card">
          {step === 'credentials' ? (
            <>
              <div className="signin-card-header">
                <h2 className="signin-title">{t('signIn')}</h2>
                <p className="signin-subtitle">{t('signInSubtitle')}</p>
              </div>

              <form className="signin-form" onSubmit={handleCredentialsSubmit} noValidate>
                {error && <div className="signin-error">{error}</div>}
                {success && <div className="signin-error signin-success">{success}</div>}

                <label className="signin-label" htmlFor="email">
                  {t('emailAddress')}
                </label>
                <div className="signin-field">
                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="username"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-required="true"
                  />
                  <span className="signin-field-icon" aria-hidden="true">
                    <UserIcon />
                  </span>
                </div>

                <label className="signin-label" htmlFor="password">
                  {t('password')}
                </label>
                <div className="signin-field">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="signin-field-icon signin-toggle-password"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                <div className="signin-options">
                  <label className="signin-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>{t('rememberMe')}</span>
                  </label>
                </div>

                <button type="submit" className="signin-submit" disabled={loading}>
                  <ArrowRightIcon />
                  {loading ? t('loading') : t('signInButton')}
                </button>

                <div className="signin-language">
                  <label className="signin-radio">
                    <input
                      type="radio"
                      name="language"
                      value="en"
                      checked={language === 'en'}
                      onChange={() => setLanguage('en')}
                    />
                    <span>{t('english')}</span>
                  </label>
                  <label className="signin-radio">
                    <input
                      type="radio"
                      name="language"
                      value="el"
                      checked={language === 'el'}
                      onChange={() => setLanguage('el')}
                    />
                    <span>{t('greek')}</span>
                  </label>
                </div>
              </form>

              <div className="signin-footer">
                <Link to="/forgot-password" className="signin-forgot">
                  {t('forgotPassword')}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="signin-card-header">
                <div className="signin-mfa-badge">
                  <ShieldIcon />
                  <span>{t('mfaBadge')}</span>
                </div>
                <h2 className="signin-title">{t('mfaTitle')}</h2>
                <p className="signin-subtitle">{t('mfaSubtitle')}</p>
                <p className="signin-mfa-email">{email}</p>
              </div>

              <form className="signin-form" onSubmit={handleMfaSubmit}>
                {error && <div className="signin-error">{error}</div>}

                <label className="signin-label" htmlFor="mfa-code">
                  {t('mfaCode')}
                </label>
                <div className="signin-field signin-field-mfa">
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={t('mfaCodePlaceholder')}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                  <span className="signin-field-icon" aria-hidden="true">
                    <ShieldIcon />
                  </span>
                </div>

                <p className="signin-mfa-hint">{t('mfaHint')}</p>

                <button
                  type="submit"
                  className="signin-submit"
                  disabled={loading || mfaCode.length !== 6}
                >
                  <ArrowRightIcon />
                  {loading ? t('loading') : t('mfaVerify')}
                </button>

                <button type="button" className="signin-back" onClick={handleBackToCredentials}>
                  {t('mfaBack')}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  );
}
