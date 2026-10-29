import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createStenotypistLeave,
  fetchStenotypistLeaveById,
  fetchStenotypistLeaveCandidates,
  updateStenotypistLeave,
  type StenotypistLeaveCandidate,
} from '../../api/stenotypistLeaves';
import {
  STENOTYPIST_LEAVE_REASON_OPTIONS,
  STENOTYPIST_LEAVE_STATUS_OPTIONS,
  stenotypistLeaveReasonLabelKey,
  stenotypistLeaveStatusLabelKey,
} from '../../config/stenotypistLeave';
import {
  canManageStenotypistLeaveForOthers,
} from '../../config/permissions';
import type { StenotypistLeavePayload, StenotypistLeaveStatus } from '../../types/stenotypistLeave';
import { getAuthUser } from '../../utils/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface StenotypistLeaveDetailsFormProps {
  mode: 'create' | 'edit';
  leaveId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type LeaveFormState = {
  stenotypistUserId: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: StenotypistLeaveStatus;
  createdByName: string;
  createdOn: string;
};

const EMPTY_FORM: LeaveFormState = {
  stenotypistUserId: '',
  dateFrom: '',
  dateTo: '',
  reason: '',
  status: 'new',
  createdByName: '',
  createdOn: '',
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
  return t('stenotypistLeaveSaveError');
}

function formatCreatedOn(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function canManageAllStenotypists(): boolean {
  const user = getAuthUser();
  return canManageStenotypistLeaveForOthers(user?.roles ?? user?.role);
}

export default function StenotypistLeaveDetailsForm({
  mode,
  leaveId,
  onCancel,
  onSaved,
}: StenotypistLeaveDetailsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stenotypists, setStenotypists] = useState<StenotypistLeaveCandidate[]>([]);
  const [form, setForm] = useState<LeaveFormState>(EMPTY_FORM);
  const [initialStatus, setInitialStatus] = useState<StenotypistLeaveStatus>('new');
  const manageAllStenotypists = useMemo(() => canManageAllStenotypists(), []);

  useEffect(() => {
    let active = true;
    fetchStenotypistLeaveCandidates()
      .then((candidates) => {
        if (!active) return;
        setStenotypists(candidates);
        if (mode === 'create' && candidates.length === 1) {
          setForm((current) => ({
            ...current,
            stenotypistUserId: current.stenotypistUserId || candidates[0].id,
          }));
        }
      })
      .catch(() => {
        if (active) setError(t('stenotypistLeaveCandidatesLoadError'));
      });

    return () => {
      active = false;
    };
  }, [mode, t]);

  useEffect(() => {
    if (mode !== 'edit' || !leaveId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchStenotypistLeaveById(leaveId)
      .then((leave) => {
        if (!active) return;
        setForm({
          stenotypistUserId: leave.stenotypistUserId,
          dateFrom: leave.dateFrom,
          dateTo: leave.dateTo,
          reason: leave.reason,
          status: leave.status,
          createdByName: leave.createdByName || '—',
          createdOn: formatCreatedOn(leave.createdAt),
        });
        setInitialStatus(leave.status);
      })
      .catch(() => {
        if (active) setError(t('stenotypistLeaveLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, leaveId, t]);

  const validateClient = (): string | null => {
    if (!form.stenotypistUserId.trim()) return t('stenotypistRequired');
    if (!form.dateFrom.trim()) return t('stenotypistLeaveDateFromRequired');
    if (!form.dateTo.trim()) return t('stenotypistLeaveDateToRequired');
    if (form.dateFrom > form.dateTo) return t('stenotypistLeaveDateRangeInvalid');
    if (!form.reason.trim()) return t('stenotypistLeaveReasonRequired');
    return null;
  };

  const buildPayload = (): StenotypistLeavePayload => {
    const payload: StenotypistLeavePayload = {
      stenotypistUserId: form.stenotypistUserId.trim(),
      dateFrom: form.dateFrom.trim(),
      dateTo: form.dateTo.trim(),
      reason: form.reason,
    };

    if (manageAllStenotypists) {
      payload.status = form.status;
    } else if (mode === 'edit') {
      payload.status = initialStatus;
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createStenotypistLeave(payload);
        const user = getAuthUser();
        const submittedByStenotypist =
          !manageAllStenotypists && user?.id === payload.stenotypistUserId;
        onSaved(
          submittedByStenotypist
            ? t('stenotypistLeaveSubmittedSuccess')
            : t('stenotypistLeaveCreatedSuccess'),
        );
      } else if (leaveId) {
        await updateStenotypistLeave(leaveId, payload);
        const statusChanged =
          initialStatus !== payload.status &&
          (payload.status === 'approved' || payload.status === 'rejected');
        onSaved(
          statusChanged
            ? t('stenotypistLeaveStatusUpdatedSuccess')
            : t('stenotypistLeaveUpdatedSuccess'),
        );
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof LeaveFormState>(key: K, value: LeaveFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create'
                ? t('stenotypistLeaveDetailsCreateTitle')
                : t('stenotypistLeaveDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            {manageAllStenotypists && (
              <>
                <label className="profile-label" htmlFor="leave-stenotypist">
                  {t('stenotypist')} *
                </label>
                <select
                  id="leave-stenotypist"
                  className="profile-input"
                  value={form.stenotypistUserId}
                  onChange={(event) => updateField('stenotypistUserId', event.target.value)}
                >
                  <option value="">{t('selectOption')}</option>
                  {stenotypists.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.username})
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="profile-label" htmlFor="leave-date-from">
              {t('dateFrom')} *
            </label>
            <input
              id="leave-date-from"
              type="date"
              className="profile-input"
              value={form.dateFrom}
              onChange={(event) => updateField('dateFrom', event.target.value)}
            />

            <label className="profile-label" htmlFor="leave-date-to">
              {t('dateTo')} *
            </label>
            <input
              id="leave-date-to"
              type="date"
              className="profile-input"
              value={form.dateTo}
              onChange={(event) => updateField('dateTo', event.target.value)}
            />

            <label className="profile-label" htmlFor="leave-reason">
              {t('reason')} *
            </label>
            <select
              id="leave-reason"
              className="profile-input"
              value={form.reason}
              onChange={(event) => updateField('reason', event.target.value)}
            >
              <option value="">{t('selectOption')}</option>
              {STENOTYPIST_LEAVE_REASON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(stenotypistLeaveReasonLabelKey(option))}
                </option>
              ))}
            </select>

            {manageAllStenotypists && (
              <>
                <label className="profile-label" htmlFor="leave-status">
                  {t('status')} *
                </label>
                <select
                  id="leave-status"
                  className="profile-input"
                  value={form.status}
                  onChange={(event) =>
                    updateField('status', event.target.value as StenotypistLeaveStatus)
                  }
                >
                  {STENOTYPIST_LEAVE_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(stenotypistLeaveStatusLabelKey(option))}
                    </option>
                  ))}
                </select>
              </>
            )}

            {mode === 'edit' && (
              <>
                <label className="profile-label" htmlFor="leave-created-by">
                  {t('createdBy')}
                </label>
                <input
                  id="leave-created-by"
                  className="profile-input profile-input-readonly"
                  value={form.createdByName}
                  readOnly
                />

                <label className="profile-label" htmlFor="leave-created-on">
                  {t('createdOn')}
                </label>
                <input
                  id="leave-created-on"
                  className="profile-input profile-input-readonly"
                  value={form.createdOn}
                  readOnly
                />
              </>
            )}
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel}>
              {t('cancel')}
            </button>
            <button type="submit" className="profile-submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
