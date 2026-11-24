import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createUser,
  fetchCustomers,
  fetchUserById,
  updateUser,
  type CustomerOption,
  type UserDetailsPayload,
} from '../../api/profile';
import { getAssignableRoles } from '../../config/userRoleRules';
import type { UserRole } from '../../config/roles';
import { getRoleLabelKey, normalizeRoles } from '../../config/roles';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Language, TranslationKey } from '../../i18n/translations';
import { getAuthUser } from '../../utils/auth';
import { validatePasswordPolicy } from '../../config/passwordPolicy';
import '../../styles/profile.css';

interface UserDetailsFormProps {
  mode: 'create' | 'edit' | 'view';
  userId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
  onSwitchToEdit?: () => void;
}

const EMPTY_FORM = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  contactPhone: '',
  mobilePhone: '',
  customerId: '',
  language: 'en' as Language,
  assignedRoles: [] as UserRole[],
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
  return t('userSaveError');
}

export default function UserDetailsForm({
  mode,
  userId,
  onCancel,
  onSaved,
  onSwitchToEdit,
}: UserDetailsFormProps) {
  const { t } = useLanguage();
  const actor = getAuthUser();
  const actorRoles = normalizeRoles(actor?.roles ?? actor?.role);
  const readOnly = mode === 'view';

  const [loading, setLoading] = useState(mode === 'edit' || mode === 'view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [fullName, setFullName] = useState(EMPTY_FORM.fullName);
  const [username, setUsername] = useState(EMPTY_FORM.username);
  const [email, setEmail] = useState(EMPTY_FORM.email);
  const [password, setPassword] = useState(EMPTY_FORM.password);
  const [contactPhone, setContactPhone] = useState(EMPTY_FORM.contactPhone);
  const [mobilePhone, setMobilePhone] = useState(EMPTY_FORM.mobilePhone);
  const [customerId, setCustomerId] = useState(EMPTY_FORM.customerId);
  const [language, setLanguage] = useState<Language>(EMPTY_FORM.language);
  const [assignedRoles, setAssignedRoles] = useState<UserRole[]>(EMPTY_FORM.assignedRoles);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [initialCustomerId, setInitialCustomerId] = useState('');

  const [availableSelection, setAvailableSelection] = useState<UserRole[]>([]);
  const [assignedSelection, setAssignedSelection] = useState<UserRole[]>([]);

  const customerValue = customerId || null;

  const allowedRoles = useMemo(
    () => getAssignableRoles(actorRoles, customerValue),
    [actorRoles, customerValue],
  );

  const availableRoles = useMemo(
    () => allowedRoles.filter((role) => !assignedRoles.includes(role)),
    [allowedRoles, assignedRoles],
  );

  useEffect(() => {
    let active = true;

    fetchCustomers()
      .then((data) => {
        if (active) setCustomers(data);
      })
      .catch(() => {
        if (active) setError(t('customersLoadError'));
      });

    if ((mode === 'edit' || mode === 'view') && userId) {
      setLoading(true);
      fetchUserById(userId)
        .then((user) => {
          if (!active) return;
          setFullName(user.fullName);
          setUsername(user.username);
          setEmail(user.email);
          setContactPhone(user.contactPhone);
          setMobilePhone(user.mobilePhone);
          setCustomerId(user.customerId ?? '');
          setInitialCustomerId(user.customerId ?? '');
          setLanguage(user.language);
          setAssignedRoles(normalizeRoles(user.roles));
          setStatus(user.status);
        })
        .catch(() => {
          if (active) setError(t('profileLoadError'));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [mode, userId, t]);

  const handleCustomerChange = (nextCustomerId: string) => {
    if (readOnly) return;
    if (mode === 'edit' && nextCustomerId !== initialCustomerId) {
      setAssignedRoles([]);
      setAssignedSelection([]);
      setAvailableSelection([]);
      setNotice(t('customerRolesCleared'));
    } else if (mode === 'create' && nextCustomerId !== customerId) {
      const nextAllowed = new Set(getAssignableRoles(actorRoles, nextCustomerId || null));
      setAssignedRoles((current) => current.filter((role) => nextAllowed.has(role)));
    }
    setCustomerId(nextCustomerId);
  };

  const handleAssign = () => {
    if (readOnly || availableSelection.length === 0) return;
    setAssignedRoles((current) => [
      ...new Set([...current, ...availableSelection]),
    ]);
    setAvailableSelection([]);
    setNotice('');
  };

  const handleUnassign = () => {
    if (readOnly || assignedSelection.length === 0) return;
    setAssignedRoles((current) =>
      current.filter((role) => !assignedSelection.includes(role)),
    );
    setAssignedSelection([]);
  };

  const validateClient = (): string | null => {
    if (!fullName.trim()) return t('fullNameRequired');
    if (!username.trim()) return t('usernameRequired');
    if (!email.trim()) return t('emailRequired');
    if (mode === 'edit' && password.trim()) {
      const policyErrors = validatePasswordPolicy(password.trim());
      if (policyErrors.length > 0) {
        return policyErrors.map((key) => t(key)).join(' ');
      }
    }
    if (assignedRoles.length === 0) return t('rolesRequired');
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError('');
    setNotice('');

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    const payload: UserDetailsPayload = {
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      contactPhone: contactPhone.trim(),
      mobilePhone: mobilePhone.trim(),
      customerId: customerValue,
      language,
      roles: assignedRoles,
      ...(mode === 'edit' && password.trim() ? { password: password.trim() } : {}),
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await createUser(payload);
        onSaved(t('userCreatedWithTempPasswordSuccess'));
      } else if (userId) {
        await updateUser(userId, payload);
        onSaved(t('userUpdatedSuccess'));
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

  const title =
    mode === 'create'
      ? t('userDetailsCreateTitle')
      : mode === 'view'
        ? t('userDetailsViewTitle')
        : t('userDetailsEditTitle');

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="user-details-header">
            <h2>{title}</h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {notice && <div className="profile-alert profile-alert-warning">{notice}</div>}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="userFullName">
              {t('fullName')} *
            </label>
            <input
              id="userFullName"
              className="profile-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={!readOnly}
              disabled={readOnly}
              readOnly={readOnly}
            />

            <label className="profile-label" htmlFor="userUsername">
              {t('username')} *
            </label>
            <input
              id="userUsername"
              className="profile-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={!readOnly}
              disabled={readOnly}
              readOnly={readOnly}
            />

            <label className="profile-label" htmlFor="userEmail">
              {t('email')} *
            </label>
            <input
              id="userEmail"
              type="email"
              className="profile-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!readOnly}
              disabled={readOnly}
              readOnly={readOnly}
            />

            {mode === 'create' ? (
              <>
                <label className="profile-label">{t('password')}</label>
                <p className="profile-field-hint profile-field-hint-inline">
                  {t('temporaryPasswordAutoHint')}
                </p>
              </>
            ) : mode === 'edit' ? (
              <>
                <label className="profile-label" htmlFor="userPassword">
                  {t('password')} ({t('optional')})
                </label>
                <input
                  id="userPassword"
                  type="password"
                  className="profile-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordKeepBlank')}
                />
                <p className="profile-field-hint">{t('passwordPolicyRequirements')}</p>
              </>
            ) : null}

            <label className="profile-label" htmlFor="userContactPhone">
              {t('contactPhone')}
            </label>
            <input
              id="userContactPhone"
              className="profile-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={readOnly}
              readOnly={readOnly}
            />

            <label className="profile-label" htmlFor="userMobilePhone">
              {t('mobilePhone')}
            </label>
            <input
              id="userMobilePhone"
              className="profile-input"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              disabled={readOnly}
              readOnly={readOnly}
            />

            <label className="profile-label" htmlFor="userCustomer">
              {t('customer')}
            </label>
            <select
              id="userCustomer"
              className="profile-input"
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              disabled={readOnly}
            >
              <option value="">{t('noCustomerSelected')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="userLanguage">
              {t('language')}
            </label>
            <select
              id="userLanguage"
              className="profile-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              disabled={readOnly}
            >
              <option value="en">{t('english')}</option>
              <option value="el">{t('greek')}</option>
            </select>

            <label className="profile-label">{t('roles')}</label>
            <div className="role-assignment">
              <div className="role-column">
                <div className="role-column-title">{t('availableRoles')}</div>
                <select
                  multiple
                  size={6}
                  className="role-list"
                  value={availableSelection}
                  disabled={readOnly}
                  onChange={(e) =>
                    setAvailableSelection(
                      Array.from(e.target.selectedOptions, (option) => option.value as UserRole),
                    )
                  }
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {t(getRoleLabelKey(role))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="role-actions">
                <button
                  type="button"
                  className="role-action-btn"
                  onClick={handleAssign}
                  disabled={readOnly}
                >
                  {t('assignRole')} →
                </button>
                <button
                  type="button"
                  className="role-action-btn"
                  onClick={handleUnassign}
                  disabled={readOnly}
                >
                  ← {t('unassignRole')}
                </button>
              </div>

              <div className="role-column">
                <div className="role-column-title">{t('assignedRoles')} *</div>
                <select
                  multiple
                  size={6}
                  className="role-list"
                  value={assignedSelection}
                  disabled={readOnly}
                  onChange={(e) =>
                    setAssignedSelection(
                      Array.from(e.target.selectedOptions, (option) => option.value as UserRole),
                    )
                  }
                >
                  {assignedRoles.map((role) => (
                    <option key={role} value={role}>
                      {t(getRoleLabelKey(role))}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="profile-label">{t('status')}</label>
            <div>
              <span className={`profile-status-badge profile-status-${status}`}>
                {status === 'inactive' ? t('statusInactive') : t('statusActive')}
              </span>
              <p className="profile-field-hint">{t('userStatusReadOnlyHint')}</p>
            </div>
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel}>
              {readOnly ? t('close') : t('cancel')}
            </button>
            {readOnly && onSwitchToEdit ? (
              <button type="button" className="profile-submit" onClick={onSwitchToEdit}>
                {t('edit')}
              </button>
            ) : null}
            {!readOnly ? (
              <button type="submit" className="profile-submit" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
