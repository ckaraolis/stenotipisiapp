import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveJob,
  confirmAllPendingJobs,
  confirmJob,
  deleteJob,
  fetchJobRecords,
  rejectJob,
} from '../../api/jobs';
import {
  JOB_LIST_PAGE_SIZE,
  filterJobListRows,
  formatJobCustomerLabel,
  formatJobProjectLabel,
  formatJobStenotypistLabel,
  getDefaultJobDateRange,
  getJobListFilterOptions,
  getJobListInlineActions,
  getJobListCapabilities,
  filterJobsForJobListView,
  sortJobListRows,
  type JobListInlineAction,
} from '../../config/jobList';
import { getPhaseForJobStatus, jobPhaseLabelKey, jobStatusLabelKey } from '../../config/job';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { JobAssignmentRole } from '../../types/job';
import type { JobRecord } from '../../types/jobRecord';
import JobDetailsForm from './JobDetailsForm';
import JobSubmissionWorkflow from './JobSubmissionWorkflow';
import StenotypistAssignmentForm from './StenotypistAssignmentForm';
import JobRejectDialog, { parseJobActionError } from './JobRejectDialog';
import JobDeleteDialog from './JobDeleteDialog';
import { getAuthUser } from '../../utils/auth';
import { formatDateDisplay } from '../../utils/dateFormat';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/scheduling.css';
import '../../styles/profile.css';

interface SchedulingJobsViewProps {
  jobType: 'steno' | 'audio' | 'caption';
}

type FormMode = 'closed' | 'create' | 'edit' | 'submission' | 'assign';

const subtitleByType: Record<SchedulingJobsViewProps['jobType'], TranslationKey> = {
  steno: 'jobsStenoSubtitle',
  audio: 'jobsAudioSubtitle',
  caption: 'jobsCaptionSubtitle',
};

const INLINE_ACTION_LABELS: Record<JobListInlineAction, TranslationKey> = {
  edit: 'edit',
  approve: 'approve',
  reject: 'reject',
  assign: 'assign',
  confirm: 'confirm',
  finish: 'finish',
  delete: 'delete',
};

function getJobAssignmentRoles(job: JobRecord, userId: string | undefined): JobAssignmentRole[] {
  const roles: JobAssignmentRole[] = [];
  if (userId && job.stenotypistUserId === userId) {
    roles.push('stenotypist');
  }
  return roles;
}

export default function SchedulingJobsView({ jobType }: SchedulingJobsViewProps) {
  const { t } = useLanguage();
  const authUser = getAuthUser();
  const userRoles = authUser?.roles ?? authUser?.role;
  const listCapabilities = useMemo(() => getJobListCapabilities(userRoles), [userRoles]);

  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangeInitialized, setDateRangeInitialized] = useState(false);
  const [customerFilter, setCustomerFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stenotypistFilter, setStenotypistFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<JobRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionLoadingJobId, setActionLoadingJobId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJobRecords();
      setJobs(data);
    } catch {
      setError(t('jobsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const visibleJobs = useMemo(
    () =>
      filterJobsForJobListView(jobs, {
        userId: authUser?.id,
        customerId: authUser?.customerId ?? undefined,
        roleOrRoles: userRoles,
      }),
    [jobs, authUser?.id, authUser?.customerId, userRoles],
  );

  useEffect(() => {
    if (!dateRangeInitialized && !loading) {
      const range = getDefaultJobDateRange(visibleJobs);
      setDateFrom(range.from);
      setDateTo(range.to);
      setDateRangeInitialized(true);
    }
  }, [visibleJobs, loading, dateRangeInitialized]);

  useEffect(() => {
    if (!autoRefresh || formMode !== 'closed') return;
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, formMode, loadJobs]);

  const filterOptions = useMemo(() => getJobListFilterOptions(visibleJobs), [visibleJobs]);

  const filteredRows = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    return filterJobListRows(sortJobListRows(visibleJobs), {
      dateFrom,
      dateTo,
      customerId: customerFilter,
      projectId: projectFilter,
      phase: phaseFilter,
      status: statusFilter,
      stenotypistUserId: stenotypistFilter,
      search,
    });
  }, [
    visibleJobs,
    dateFrom,
    dateTo,
    customerFilter,
    projectFilter,
    phaseFilter,
    statusFilter,
    stenotypistFilter,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / JOB_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * JOB_LIST_PAGE_SIZE,
    currentPage * JOB_LIST_PAGE_SIZE,
  );

  const handleOpenCreate = () => {
    setSuccess('');
    setSelectedJobId(null);
    setFormMode('create');
  };

  const handleOpenEdit = (jobId: string) => {
    setSuccess('');
    setSelectedJobId(jobId);
    setFormMode('edit');
  };

  const handleOpenSubmission = (jobId: string) => {
    setSuccess('');
    setSelectedJobId(jobId);
    setFormMode('submission');
  };

  const handleOpenAssign = (jobId: string) => {
    setSuccess('');
    setSelectedJobId(jobId);
    setFormMode('assign');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedJobId(null);
  };

  const handleSaved = (message: string) => {
    setFormMode('closed');
    setSelectedJobId(null);
    setSuccess(message);
    void loadJobs();
  };

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    setError('');
    try {
      await confirmAllPendingJobs();
      setSuccess(t('jobConfirmAllSuccess'));
      await loadJobs();
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
    } finally {
      setConfirmingAll(false);
    }
  };

  const handleInlineAction = async (job: JobRecord, action: JobListInlineAction) => {
    switch (action) {
      case 'edit':
        handleOpenEdit(job.id);
        return;
      case 'assign':
        handleOpenAssign(job.id);
        return;
      case 'finish':
        handleOpenSubmission(job.id);
        return;
      case 'reject':
        setRejectError('');
        setRejectReason('');
        setRejectTarget(job);
        return;
      case 'delete':
        setDeleteError('');
        setDeleteTarget(job);
        return;
      default:
        break;
    }

    setActionLoadingJobId(job.id);
    setError('');
    try {
      if (action === 'approve') {
        await approveJob(job.id);
        setSuccess(t('jobApprovedSuccess'));
      } else if (action === 'confirm') {
        await confirmJob(job.id);
        setSuccess(t('jobConfirmedSuccess'));
      }
      await loadJobs();
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleRejectCancel = () => {
    setRejectTarget(null);
    setRejectReason('');
    setRejectError('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    if (!rejectReason) {
      setRejectError(t('jobRejectionReasonRequired'));
      return;
    }

    setRejecting(true);
    setRejectError('');
    try {
      await rejectJob(rejectTarget.id, { rejectionReason: rejectReason });
      setRejectTarget(null);
      setRejectReason('');
      setSuccess(t('jobRejectedSuccess'));
      await loadJobs();
    } catch (err) {
      setRejectError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
    } finally {
      setRejecting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteJob(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('jobDeletedSuccess'));
      await loadJobs();
    } catch (err) {
      setDeleteError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="scheduling-page">
      <div className="page-header scheduling-header">
        <div>
          <h1 className="page-title">{t('jobs')}</h1>
          <p className="page-subtitle">{t(subtitleByType[jobType])}</p>
        </div>
        {formMode === 'closed' && (
          <div className="scheduling-actions">
            {listCapabilities.showAddNew ? (
              <button type="button" className="btn-primary" onClick={handleOpenCreate}>
                {t('addNew')}
              </button>
            ) : null}
            {listCapabilities.showConfirmAll ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleConfirmAll()}
                disabled={confirmingAll}
              >
                {confirmingAll ? t('saving') : t('confirmAll')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {success && <div className="profile-alert profile-alert-success">{success}</div>}
      {error && formMode === 'closed' && !rejectTarget && !deleteTarget && (
        <div className="profile-alert profile-alert-error">{error}</div>
      )}

      {formMode === 'create' || formMode === 'edit' ? (
        <JobDetailsForm
          mode={formMode}
          jobId={selectedJobId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      ) : null}

      {formMode === 'submission' && selectedJobId ? (
        <JobSubmissionWorkflow
          jobId={selectedJobId}
          onCancel={handleCloseForm}
          onCompleted={handleSaved}
        />
      ) : null}

      {formMode === 'assign' && selectedJobId ? (
        <StenotypistAssignmentForm
          jobId={selectedJobId}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      ) : null}

      {rejectTarget ? (
        <JobRejectDialog
          jobNumber={rejectTarget.jobNumber}
          rejectionReason={rejectReason}
          error={rejectError}
          saving={rejecting}
          onRejectionReasonChange={setRejectReason}
          onCancel={handleRejectCancel}
          onConfirm={() => void handleRejectConfirm()}
        />
      ) : null}

      {deleteTarget ? (
        <JobDeleteDialog
          jobNumber={deleteTarget.jobNumber}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      {formMode === 'closed' && (
        <div className="scheduling-panel">
          <div className="filters">
            <div className="filters-title">{t('filterJobs')}</div>
            <div className="filters-row">
              <label className="date-field">
                <span>{t('dateFrom')}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="date-field">
                <span>{t('dateTo')}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              {listCapabilities.showCustomerFilter ? (
                <FilterSelect
                  label={t('allCustomers')}
                  value={customerFilter}
                  options={filterOptions.customers}
                  onChange={(value) => {
                    setCustomerFilter(value);
                    setPage(1);
                  }}
                />
              ) : null}
              <FilterSelect
                label={t('allProjects')}
                value={projectFilter}
                options={filterOptions.projects}
                onChange={(value) => {
                  setProjectFilter(value);
                  setPage(1);
                }}
              />
              <FilterSelect
                label={t('allPhases')}
                value={phaseFilter}
                options={filterOptions.phases.map((phase) => ({
                  id: phase,
                  label: t(jobPhaseLabelKey(phase)),
                }))}
                onChange={(value) => {
                  setPhaseFilter(value);
                  setPage(1);
                }}
              />
              <FilterSelect
                label={t('allStatuses')}
                value={statusFilter}
                options={filterOptions.statuses.map((status) => ({
                  id: status,
                  label: t(jobStatusLabelKey(status)),
                }))}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              />
              <FilterSelect
                label={t('allStenotypists')}
                value={stenotypistFilter}
                options={filterOptions.stenotypists}
                onChange={(value) => {
                  setStenotypistFilter(value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filters-row">
              <div className="filters-actions">
                <label className="auto-refresh">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <span>
                    {t('autoRefresh')}: {autoRefresh ? t('on') : t('off')}
                  </span>
                </label>
                <input
                  type="search"
                  className="search-input"
                  placeholder={t('search')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className="refresh-btn"
                  aria-label="Refresh"
                  onClick={() => void loadJobs()}
                >
                  <RefreshIcon />
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="scheduling-table">
              <thead>
                <tr>
                  <th>{t('jobNumber')}</th>
                  <th>{t('customer')}</th>
                  <th>{t('project')}</th>
                  <th>{t('jobPhase')}</th>
                  <th>{t('status')}</th>
                  <th>{t('district')}</th>
                  <th>{t('locationDetails')}</th>
                  <th>{t('date')}</th>
                  <th>{t('time')}</th>
                  <th>{t('stenotypist')}</th>
                  <th>{t('expedite')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading || !dateRangeInitialized ? (
                  <tr>
                    <td colSpan={12} className="empty-row">
                      {t('loading')}
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="empty-row">
                      {t('noJobsFound')}
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => {
                    const phase = getPhaseForJobStatus(row.status);
                    const assignmentRoles = getJobAssignmentRoles(row, authUser?.id);
                    const inlineActions = getJobListInlineActions(row, {
                      userId: authUser?.id,
                      customerId: authUser?.customerId ?? undefined,
                      roleOrRoles: userRoles,
                      assignmentRoles,
                    });
                    const isRowLoading = actionLoadingJobId === row.id;

                    return (
                      <tr key={row.id}>
                        <td>{row.jobNumber}</td>
                        <td>{formatJobCustomerLabel(row)}</td>
                        <td className="project-cell">{formatJobProjectLabel(row)}</td>
                        <td>{phase ? t(jobPhaseLabelKey(phase)) : '—'}</td>
                        <td>
                          <span className={`status-pill status-${row.status}`}>
                            {t(jobStatusLabelKey(row.status))}
                          </span>
                        </td>
                        <td>
                          {formatDistrictLabel({
                            districtName: row.districtName,
                            districtAlias: row.districtAlias,
                          })}
                        </td>
                        <td>{row.locationDetails || '—'}</td>
                        <td>{formatDateDisplay(row.date)}</td>
                        <td>{row.time}</td>
                        <td>{formatJobStenotypistLabel(row)}</td>
                        <td className="center">{row.expedite ? '✓' : ''}</td>
                        <td>
                          <div className="scheduling-inline-actions">
                            {inlineActions.map((action) => (
                              <button
                                key={action}
                                type="button"
                                disabled={isRowLoading}
                                onClick={() => void handleInlineAction(row, action)}
                              >
                                {t(INLINE_ACTION_LABELS[action])}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('previous')}
            </button>
            <span className="pagination-info">
              {t('page')} {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-select">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}
