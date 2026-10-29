import { useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { fetchProfile, type UserProfile } from '../api/profile';

import AccountDetailsForm from '../components/account/AccountDetailsForm';

import ChangePasswordForm from '../components/account/ChangePasswordForm';

import { useLanguage } from '../i18n/LanguageContext';

import { updateStoredUser } from '../utils/auth';

import '../styles/profile.css';



type AccountSection = 'my-account' | 'change-password';



export default function AccountManagementPage() {

  const { t } = useLanguage();

  const [searchParams, setSearchParams] = useSearchParams();

  const section = (searchParams.get('section') as AccountSection | null) ?? 'my-account';

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');



  const loadProfile = async () => {

    setLoading(true);

    setError('');

    try {

      const data = await fetchProfile();

      setProfile(data);

    } catch {

      setError(t('profileLoadError'));

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    void loadProfile();

  }, []);



  const setSection = (next: AccountSection) => {

    setSearchParams(next === 'my-account' ? {} : { section: next });

  };



  const handleAccountSaved = (updated: UserProfile, _emailChanged: boolean) => {

    updateStoredUser(updated);

    setProfile(updated);

  };



  const handlePasswordChanged = (updated?: UserProfile) => {

    if (updated) {

      updateStoredUser(updated);

      setProfile(updated);

    }

  };



  return (

    <div className="account-management-page">

      <div className="page-header">

        <div>

          <h1 className="page-title">{t('accountManagement')}</h1>

          <p className="page-subtitle">{t('accountManagementSubtitle')}</p>

        </div>

      </div>



      <div className="account-management-layout">

        <nav className="account-management-nav">

          <button

            type="button"

            className={`account-nav-item${section === 'my-account' ? ' active' : ''}`}

            onClick={() => setSection('my-account')}

          >

            {t('myAccount')}

          </button>

          <button

            type="button"

            className={`account-nav-item${section === 'change-password' ? ' active' : ''}`}

            onClick={() => setSection('change-password')}

          >

            {t('changePassword')}

          </button>

        </nav>



        <div className="profile-card account-management-panel">

          {loading ? (

            <div className="profile-message">{t('loading')}</div>

          ) : error ? (

            <div className="profile-alert profile-alert-error">{error}</div>

          ) : section === 'my-account' ? (

            <div>

              <h2>{t('myAccount')}</h2>

              <p className="profile-field-hint">{t('accountDetailsHint')}</p>

              {profile && (

                <AccountDetailsForm

                  profile={profile}

                  onSaved={handleAccountSaved}

                  onChangePassword={() => setSection('change-password')}

                />

              )}

            </div>

          ) : (

            <div>

              <h2>{t('changePassword')}</h2>

              <p className="profile-field-hint">{t('changePasswordAccountHint')}</p>

              <ChangePasswordForm

                mode="account"

                userEmail={profile?.email}

                onSuccess={handlePasswordChanged}

              />

            </div>

          )}

        </div>

      </div>

    </div>

  );

}

