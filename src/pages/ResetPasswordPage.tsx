import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { validateResetToken } from '../api/auth';
import ChangePasswordForm from '../components/account/ChangePasswordForm';
import { useLanguage } from '../i18n/LanguageContext';
import '../styles/signin.css';
import '../styles/profile.css';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError(t('resetTokenInvalid'));
      setLoading(false);
      return;
    }

    validateResetToken(token)
      .then((result) => setEmail(result.email))
      .catch(() => setError(t('resetTokenInvalid')))
      .finally(() => setLoading(false));
  }, [token, t]);

  const handleSuccess = () => {
    navigate('/signin', { replace: true, state: { passwordResetComplete: true } });
  };

  return (
    <div className="signin-page change-password-page">
      <section className="signin-form-panel change-password-panel">
        <div className="signin-card">
          <div className="signin-card-header">
            <h2 className="signin-title">{t('resetPasswordTitle')}</h2>
            <p className="signin-subtitle">{t('resetPasswordSubtitle')}</p>
          </div>

          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : error ? (
            <>
              <div className="signin-error">{error}</div>
              <div className="signin-footer">
                <Link to="/forgot-password" className="signin-forgot">
                  {t('forgotPassword')}
                </Link>
              </div>
            </>
          ) : (
            <ChangePasswordForm
              mode="reset"
              resetToken={token}
              userEmail={email}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </section>
    </div>
  );
}
