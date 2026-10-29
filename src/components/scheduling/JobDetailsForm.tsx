import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchDistrictOptions } from '../../api/districts';
import {
  createJob,
  fetchJobById,
  fetchJobStenotypistCandidates,
  updateJob,
  type JobStenotypistCandidate,
} from '../../api/jobs';
import { fetchProjectRecords } from '../../api/projects';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  JOB_REJECTION_REASON_OPTIONS,
  jobRejectionReasonLabelKey,
} from '../../config/jobRecord';
import { jobStatusLabelKey } from '../../config/job';
import {
  canDistrictAdminEditJob,
  canCoordinatorEditJob,
  canStenotypistEditJob,
  hasFullJobDetailsFormAccess,
  isCustomerOrganisationJobDetailsView,
  isCoordinatorJobDetailsView,
  isDistrictAdminJobDetailsView,
  isStenotypistJobDetailsView,
} from '../../config/jobListPermissions';
import { getLocationOptionsForProject } from '../../config/jobForm';
import { canManageStenotypistLeaveForOthers } from '../../config/permissions';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type { JobPayload } from '../../types/jobRecord';
import type { JobStatus } from '../../types/job';
import type { ProjectRecord } from '../../types/project';
import { getAuthUser } from '../../utils/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface JobDetailsFormProps {
  mode: 'create' | 'edit';
  jobId?: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type JobFormState = {
  jobNumber: string;
  customerId: string;
  projectId: string;
  date: string;
  time: string;
  expedite: boolean;
  rejectionReason: string;
  stenotypistUserId: string;
  locationDetails: string;
  districtId: string;
  status: string;
  remarks: string;
};

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const EMPTY_FORM: JobFormState = {
  jobNumber: '',
  customerId: '',
  projectId: '',
  date: getTodayDate(),
  time: '',
  expedite: false,
  rejectionReason: '',
  stenotypistUserId: '',
  locationDetails: '',
  districtId: '',
  status: 'new',
  remarks: '',
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
  return t('jobSaveError');
}

function canManageJobStenotypist(): boolean {
  const user = getAuthUser();
  return canManageStenotypistLeaveForOthers(user?.roles ?? user?.role);
}

function formatDistrictOptionLabel(district: DistrictOption): string {
  return formatDistrictLabel({
    districtName: district.name,
    districtAlias: district.alias,
  });
}

function formatProjectLabel(project: ProjectRecord): string {
  const customer = project.customerAlias || project.customerName;
  if (customer) {
    return `${project.projectNumber} – ${customer}`;
  }
  return project.projectNumber;
}

export default function JobDetailsForm({
  mode,
  jobId,
  onCancel,
  onSaved,
}: JobDetailsFormProps) {
  const { t } = useLanguage();
  const authUser = getAuthUser();
  const userRoles = authUser?.roles ?? authUser?.role;
  /** §4.11.3.2 — Manager (and super admin) use the unrestricted job details form. */
  const fullAccessFormView = hasFullJobDetailsFormAccess(userRoles);
  const customerOrgFormView =
    !fullAccessFormView && isCustomerOrganisationJobDetailsView(userRoles);
  const stenotypistFormView = isStenotypistJobDetailsView(userRoles);
  const districtAdminDetailsView = isDistrictAdminJobDetailsView(userRoles);
  const coordinatorDetailsView = isCoordinatorJobDetailsView(userRoles);
  const lockedCustomerId = customerOrgFormView ? (authUser?.customerId ?? '') : '';
  const locationFieldLabel = districtAdminDetailsView ? t('location') : t('locationDetails');
  const [loadedJobMeta, setLoadedJobMeta] = useState<{
    ownerUserId: string;
    status: JobStatus;
    customerId: string;
    stenotypistUserId: string;
  } | null>(null);
  const canEditLoadedJob = useMemo(() => {
    if (mode !== 'edit' || !loadedJobMeta) return true;
    if (stenotypistFormView) {
      return canStenotypistEditJob(loadedJobMeta, authUser?.id);
    }
    if (districtAdminDetailsView) {
      return canDistrictAdminEditJob(loadedJobMeta, authUser?.id);
    }
    if (coordinatorDetailsView) {
      return canCoordinatorEditJob(loadedJobMeta, authUser?.customerId ?? undefined);
    }
    return true;
  }, [
    mode,
    loadedJobMeta,
    stenotypistFormView,
    districtAdminDetailsView,
    coordinatorDetailsView,
    authUser?.id,
    authUser?.customerId,
  ]);
  const readOnlyFormView = mode === 'edit' && !canEditLoadedJob;
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [stenotypists, setStenotypists] = useState<JobStenotypistCandidate[]>([]);
  const [form, setForm] = useState<JobFormState>(EMPTY_FORM);
  const manageStenotypist = useMemo(() => canManageJobStenotypist(), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCustomers(),
      fetchProjectRecords(),
      fetchDistrictOptions(),
      fetchJobStenotypistCandidates(),
    ])
      .then(([customerOptions, projectRecords, districtOptions, stenotypistCandidates]) => {
        if (!active) return;
        setCustomers(customerOptions);
        setProjects(projectRecords);
        setDistricts(districtOptions);
        setStenotypists(stenotypistCandidates);
      })
      .catch(() => {
        if (active) setError(t('jobsLoadError'));
      });

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'create' || !customerOrgFormView || !lockedCustomerId) return;
    setForm((current) =>
      current.customerId === lockedCustomerId ? current : { ...current, customerId: lockedCustomerId },
    );
  }, [mode, customerOrgFormView, lockedCustomerId]);

  useEffect(() => {
    if (mode !== 'edit' || !jobId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchJobById(jobId)
      .then((job) => {
        if (!active) return;
        setLoadedJobMeta({
          ownerUserId: job.ownerUserId,
          status: job.status,
          customerId: job.customerId,
          stenotypistUserId: job.stenotypistUserId,
        });
        setForm({
          jobNumber: job.jobNumber,
          customerId: job.customerId,
          projectId: job.projectId,
          date: job.date,
          time: job.time,
          expedite: job.expedite,
          rejectionReason: job.rejectionReason,
          stenotypistUserId: job.stenotypistUserId,
          locationDetails: job.locationDetails,
          districtId: job.districtId,
          status: job.status,
          remarks: job.remarks,
        });
      })
      .catch(() => {
        if (active) setError(t('jobLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, jobId, t]);

  useEffect(() => {
    if (mode !== 'edit') {
      setLoadedJobMeta(null);
    }
  }, [mode]);

  const customerProjects = useMemo(() => {
    const customerId = customerOrgFormView ? lockedCustomerId : form.customerId;
    if (!customerId) return [];
    return projects
      .filter((project) => project.customerId === customerId)
      .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber));
  }, [projects, form.customerId, customerOrgFormView, lockedCustomerId]);

  const projectLocationOptions = useMemo(() => {
    const options = getLocationOptionsForProject(form.projectId, projects);
    if (form.locationDetails && !options.includes(form.locationDetails)) {
      return [...options, form.locationDetails].sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [form.projectId, form.locationDetails, projects]);

  const selectedStenotypistLabel = useMemo(() => {
    if (!form.stenotypistUserId) return '';
    const stenotypist = stenotypists.find((row) => row.id === form.stenotypistUserId);
    return stenotypist?.fullName ?? form.stenotypistUserId;
  }, [form.stenotypistUserId, stenotypists]);

  const lockedCustomerLabel = useMemo(() => {
    if (!lockedCustomerId) return '';
    const customer = customers.find((row) => row.id === lockedCustomerId);
    if (!customer) return lockedCustomerId;
    return customer.alias ? `${customer.alias} – ${customer.name}` : customer.name;
  }, [customers, lockedCustomerId]);

  const validateClient = (): string | null => {
    if (stenotypistFormView && mode === 'edit') {
      return null;
    }
    const customerId = customerOrgFormView ? lockedCustomerId : form.customerId;
    if (!customerId.trim()) return t('jobCustomerRequired');
    if (!form.projectId.trim()) return t('jobProjectRequired');
    if (!form.date.trim()) return t('jobDateRequired');
    if (!form.time.trim()) return t('jobTimeRequired');
    return null;
  };

  const buildPayload = (): JobPayload => {
    if (stenotypistFormView && mode === 'edit') {
      return {
        projectId: form.projectId.trim(),
        date: form.date.trim(),
        time: form.time.trim(),
        locationDetails: form.locationDetails.trim(),
        remarks: form.remarks.trim(),
        expedite: form.expedite,
        districtId: form.districtId.trim() || undefined,
        stenotypistUserId: form.stenotypistUserId.trim(),
      };
    }

    const payload: JobPayload = {
      projectId: form.projectId.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      locationDetails: form.locationDetails.trim(),
      remarks: form.remarks.trim(),
      expedite: form.expedite,
    };

    if (form.districtId.trim()) {
      payload.districtId = form.districtId.trim();
    }

    if (mode === 'edit') {
      payload.stenotypistUserId = form.stenotypistUserId.trim();
    } else if (manageStenotypist) {
      payload.stenotypistUserId = form.stenotypistUserId.trim();
    }

    if (form.status === 'rejected' && form.rejectionReason.trim()) {
      payload.rejectionReason = form.rejectionReason;
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (readOnlyFormView) {
      return;
    }

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createJob(payload);
        onSaved(t('jobCreatedSuccess'));
      } else if (jobId) {
        await updateJob(jobId, payload);
        onSaved(t('jobUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof JobFormState>(key: K, value: JobFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCustomerChange = (customerId: string) => {
    setForm((current) => ({
      ...current,
      customerId,
      projectId: '',
      districtId: '',
    }));
  };

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((row) => row.id === projectId);
    const locationOptions = getLocationOptionsForProject(projectId, projects);
    setForm((current) => ({
      ...current,
      projectId,
      districtId: project?.districtId ?? '',
      locationDetails:
        current.locationDetails && locationOptions.includes(current.locationDetails)
          ? current.locationDetails
          : '',
    }));
  };

  if (stenotypistFormView && mode === 'create') {
    return <div className="profile-message">{t('jobActionNotAllowed')}</div>;
  }

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create' ? t('jobDetailsCreateTitle') : t('jobDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}

          <div className="profile-grid">
            {stenotypistFormView ? (
              <>
                {mode === 'edit' && (
                  <>
                    <label className="profile-label" htmlFor="job-number">
                      {t('jobNumber')}
                    </label>
                    <input
                      id="job-number"
                      type="text"
                      className="profile-input"
                      value={form.jobNumber}
                      readOnly
                    />
                  </>
                )}

                <label className="profile-label" htmlFor="job-stenotypist">
                  {t('stenotypist')}
                </label>
                <select
                  id="job-stenotypist"
                  className="profile-input"
                  value={form.stenotypistUserId}
                  disabled
                >
                  <option value={form.stenotypistUserId}>
                    {selectedStenotypistLabel || t('selectOption')}
                  </option>
                </select>

                <label className="profile-label" htmlFor="job-remarks">
                  {t('remarks')}
                </label>
                <textarea
                  id="job-remarks"
                  className="profile-input profile-textarea"
                  rows={3}
                  value={form.remarks}
                  onChange={(event) => updateField('remarks', event.target.value)}
                  readOnly={readOnlyFormView}
                />
              </>
            ) : (
              <>
            {mode === 'edit' && (
              <>
                <label className="profile-label" htmlFor="job-number">
                  {t('jobNumber')}
                </label>
                <input
                  id="job-number"
                  type="text"
                  className="profile-input"
                  value={form.jobNumber}
                  readOnly
                />
              </>
            )}

            <label className="profile-label" htmlFor="job-customer">
              {t('customer')} *
            </label>
            {customerOrgFormView ? (
              <select
                id="job-customer"
                className="profile-input"
                value={lockedCustomerId}
                disabled
              >
                <option value={lockedCustomerId}>
                  {lockedCustomerLabel || lockedCustomerId || t('selectOption')}
                </option>
              </select>
            ) : (
              <select
                id="job-customer"
                className="profile-input"
                value={form.customerId}
                onChange={(event) => handleCustomerChange(event.target.value)}
              >
                <option value="">{t('selectOption')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.alias ? `${customer.alias} – ${customer.name}` : customer.name}
                  </option>
                ))}
              </select>
            )}

            <label className="profile-label" htmlFor="job-project">
              {t('project')} *
            </label>
            <select
              id="job-project"
              className="profile-input"
              value={form.projectId}
              onChange={(event) => handleProjectChange(event.target.value)}
              disabled={
                readOnlyFormView ||
                (customerOrgFormView ? !lockedCustomerId : !form.customerId)
              }
            >
              <option value="">{t('selectOption')}</option>
              {customerProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatProjectLabel(project)}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="job-date">
              {t('date')} *
            </label>
            <input
              id="job-date"
              type="date"
              className="profile-input"
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
              readOnly={readOnlyFormView}
            />

            <label className="profile-label" htmlFor="job-time">
              {t('time')} *
            </label>
            <input
              id="job-time"
              type="time"
              className="profile-input"
              value={form.time}
              onChange={(event) => updateField('time', event.target.value)}
              readOnly={readOnlyFormView}
            />

            <label className="profile-label" htmlFor="job-expedite">
              {t('expedite')}
            </label>
            <label className="profile-checkbox">
              <input
                id="job-expedite"
                type="checkbox"
                checked={form.expedite}
                onChange={(event) => updateField('expedite', event.target.checked)}
                disabled={readOnlyFormView}
              />
              <span>{t('expedite')}</span>
            </label>

            {form.status === 'rejected' && (
              <>
                <label className="profile-label" htmlFor="job-rejection-reason">
                  {t('rejectionReason')}
                </label>
                <select
                  id="job-rejection-reason"
                  className="profile-input"
                  value={form.rejectionReason}
                  onChange={(event) => updateField('rejectionReason', event.target.value)}
                >
                  <option value="">{t('selectOption')}</option>
                  {JOB_REJECTION_REASON_OPTIONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {t(jobRejectionReasonLabelKey(reason))}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="profile-label" htmlFor="job-stenotypist">
              {t('stenotypist')}
            </label>
            {customerOrgFormView ? (
              <select
                id="job-stenotypist"
                className="profile-input"
                value={form.stenotypistUserId}
                disabled
              >
                <option value={form.stenotypistUserId}>
                  {selectedStenotypistLabel || t('selectOption')}
                </option>
              </select>
            ) : (
              <select
                id="job-stenotypist"
                className="profile-input"
                value={form.stenotypistUserId}
                onChange={(event) => updateField('stenotypistUserId', event.target.value)}
                disabled={!manageStenotypist}
              >
                <option value="">{t('selectOption')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {stenotypist.fullName}
                  </option>
                ))}
              </select>
            )}

            <label className="profile-label" htmlFor="job-location-details">
              {locationFieldLabel}
            </label>
            {customerOrgFormView ? (
              <select
                id="job-location-details"
                className="profile-input"
                value={form.locationDetails}
                onChange={(event) => updateField('locationDetails', event.target.value)}
                disabled={readOnlyFormView || !form.projectId}
              >
                <option value="">{t('selectOption')}</option>
                {projectLocationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id="job-location-details"
                  type="text"
                  className="profile-input"
                  value={form.locationDetails}
                  onChange={(event) => updateField('locationDetails', event.target.value)}
                />

                <label className="profile-label" htmlFor="job-district">
                  {t('district')}
                </label>
                <select
                  id="job-district"
                  className="profile-input"
                  value={form.districtId}
                  onChange={(event) => updateField('districtId', event.target.value)}
                >
                  <option value="">{t('selectOption')}</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {formatDistrictOptionLabel(district)}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="profile-label" htmlFor="job-status">
              {t('status')}
            </label>
            <input
              id="job-status"
              type="text"
              className="profile-input"
              value={t(jobStatusLabelKey(form.status))}
              readOnly
            />

            <label className="profile-label" htmlFor="job-remarks">
              {t('remarks')}
            </label>
            <textarea
              id="job-remarks"
              className="profile-input profile-textarea"
              rows={3}
              value={form.remarks}
              onChange={(event) => updateField('remarks', event.target.value)}
              readOnly={readOnlyFormView}
            />
              </>
            )}
          </div>

          <div className="profile-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving || readOnlyFormView}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
