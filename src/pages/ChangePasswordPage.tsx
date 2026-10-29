import { useNavigate } from 'react-router-dom';
import ChangePasswordForm from '../components/account/ChangePasswordForm';
import { getDefaultPath } from '../config/permissions';
import { useLanguage } from '../i18n/LanguageContext';
import { getAuthUser, signOut, updateStoredUser } from '../utils/auth';
import '../styles/signin.css';
import '../styles/profile.css';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const user = getAuthUser();

  return (
    <div className="signin-page change-password-page">
      <section className="signin-form-panel change-password-panel">
        <div className="signin-card">
          <div className="signin-card-header">
            <h2 className="signin-title">{t('changePasswordTitle')}</h2>
            <p className="signin-subtitle">{t('changePasswordSubtitle')}</p>
            {user?.email && <p className="signin-mfa-email">{user.email}</p>}
          </div>

          <ChangePasswordForm
            mode="enforced"
            userEmail={user?.email}
            onSuccess={(updated) => {
              if (updated) {
                updateStoredUser(updated);
                navigate(getDefaultPath(updated.roles ?? updated.role), { replace: true });
              }
            }}
          />

          <div className="signin-footer">
            <button
              type="button"
              className="signin-forgot"
              onClick={() => {
                void signOut();
              }}
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
