import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  confirmJobReconciliation,
  fetchJobReconciliationRecords,
} from '../../api/jobReconciliation';
import {
  fetchJobStenotypistCandidates,
  type JobStenotypistCandidate,
} from '../../api/jobs';
import { jobStatusLabelKey } from '../../config/job';
import {
  formatJobReconciliationDate,
  formatJobReconciliationProjectLabel,
  formatJobReconciliationStatus,
  formatJobReconciliationTravellingCharges,
  formatJobTravellingChargeAmount,
  getPreviousMonthDateRange,
  JOB_RECONCILIATION_LIST_STATUSES,
  parseJobReconciliationError,
} from '../../config/jobReconciliation';
import { JOB_RECONCILIATION_STATUS_OPTIONS } from '../../types/jobRecord';
import type { JobRecord, JobReconciliationStatus } from '../../types/jobRecord';
import type { JobStatus } from '../../types/job';
import { getAuthUser } from '../../utils/auth';
import { canAccessJobReconciliationModule } from '../../config/permissions';
import { useLanguage } from '../../i18n/LanguageContext';
import JobReconciliationForm from './JobReconciliationForm';
import '../../styles/financials.css';

const PAGE_SIZE = 50;

type FormMode = 'closed' | 'edit';

const defaultDateRange = getPreviousMonthDateRange();

function canReconcileJobs(): boolean {
  const user = getAuthUser();
  if (!user) return false;
  return canAccessJobReconciliationModule(user.roles ?? user.role);
}

export default function JobReconciliationTable() {
  const { t } = useLanguage();
  const canWrite = canReconcileJobs();

  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [stenotypists, setStenotypists] = useState<JobStenotypistCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
  const [jobStatus, setJobStatus] = useState<JobStatus | ''>('published');
  const [reconciliationStatus, setReconciliationStatus] = useState<JobReconciliationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchJobReconciliationRecords({
        customerId,
        stenotypistUserId,
        dateFrom,
        dateTo,
        jobStatus,
        reconciliationStatus,
      });
      setJobs(rows);
    } catch {
      setError(t('jobReconciliationLoadError'));
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFrom, dateTo, jobStatus, reconciliationStatus, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchJobStenotypistCandidates()])
      .then(([customerRows, stenotypistRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setStenotypists(stenotypistRows);
      })
      .catch(() => {
        if (active) setError(t('jobReconciliationLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const totalEntries = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = useMemo(
    () => jobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, jobs],
  );

  const resetPage = () => setPage(1);

  const handleAccept = async (jobId: string) => {
    setAcceptingId(jobId);
    setError('');
    setSuccess('');
    try {
      await confirmJobReconciliation(jobId);
      setSuccess(t('jobReconciliationAcceptSuccess'));
      await loadJobs();
    } catch (err) {
      setError(parseJobReconciliationError((err as Error).message, t));
    } finally {
      setAcceptingId(null);
    }
  };

  const canEditJob = (status: JobStatus) => status === 'published' || status === 'reconciled';
  const canAcceptJob = (status: JobStatus) => status === 'published';

  if (formMode === 'edit' && selectedJobId) {
    return (
      <JobReconciliationForm
        jobId={selectedJobId}
        onCancel={() => {
          setFormMode('closed');
          setSelectedJobId(null);
        }}
        onSaved={(message) => {
          setFormMode('closed');
          setSelectedJobId(null);
          setSuccess(message);
          void loadJobs();
        }}
      />
    );
  }

  const columnCount = 16 + (canWrite ? 1 : 0);

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('reconciliation')}</h1>
          <p className="page-subtitle">{t('jobReconciliationSubtitle')}</p>
        </div>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

        <div className="filters">
          <div className="filters-row">
            <label className="filter-select">
              <span>{t('dateFrom')}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label className="filter-select">
              <span>{t('dateTo')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label className="filter-select">
              <span>{t('customer')}</span>
              <select
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allCustomers')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('stenotypist')}</span>
              <select
                value={stenotypistUserId}
                onChange={(event) => {
                  setStenotypistUserId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allStenotypists')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {stenotypist.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('status')}</span>
              <select
                value={jobStatus}
                onChange={(event) => {
                  setJobStatus(event.target.value as JobStatus | '');
                  resetPage();
                }}
              >
                <option value="">{t('allStatuses')}</option>
                {JOB_RECONCILIATION_LIST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(jobStatusLabelKey(status))}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('reconciliationStatus')}</span>
              <select
                value={reconciliationStatus}
                onChange={(event) => {
                  setReconciliationStatus(event.target.value as JobReconciliationStatus | '');
                  resetPage();
                }}
              >
                <option value="">{t('allStatuses')}</option>
                {JOB_RECONCILIATION_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatJobReconciliationStatus(status, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <>
            <div className="table-wrap job-reconciliation-table-wrap">
              <table className="data-table job-reconciliation-table">
                <thead>
                  <tr>
                    <th>{t('jobNumber')}</th>
                    <th>{t('status')}</th>
                    <th>{t('customerAlias')}</th>
                    <th>{t('project')}</th>
                    <th>{t('date')}</th>
                    <th>{t('stenotypistAlias')}</th>
                    <th>{t('receiptNumberFromStenotypist')}</th>
                    <th>{t('receiptNumberFromAdministrator')}</th>
                    <th>{t('startTimeFromStenotypist')}</th>
                    <th>{t('startTimeFromAdministrator')}</th>
                    <th>{t('endTimeFromStenotypist')}</th>
                    <th>{t('endTimeFromAdministrator')}</th>
                    <th>{t('travellingCharges')}</th>
                    <th>{t('travellingChargesSystem')}</th>
                    <th>{t('travellingChargesAdministrator')}</th>
                    <th>{t('reconciliationStatus')}</th>
                    {canWrite ? <th>{t('actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount}>{t('noRecordsFound')}</td>
                    </tr>
                  ) : (
                    pageRows.map((job) => (
                      <tr key={job.id}>
                        <td>{job.jobNumber}</td>
                        <td>{t(jobStatusLabelKey(job.status))}</td>
                        <td>{job.customerAlias || '—'}</td>
                        <td>{formatJobReconciliationProjectLabel(job)}</td>
                        <td>{formatJobReconciliationDate(job.date)}</td>
                        <td>{job.stenotypistAlias || '—'}</td>
                        <td>{job.receiptNumberStenotypist || '—'}</td>
                        <td>{job.receiptNumberAdministrator || '—'}</td>
                        <td>{job.startTimeStenotypist || '—'}</td>
                        <td>{job.startTimeAdministrator || '—'}</td>
                        <td>{job.endTimeStenotypist || '—'}</td>
                        <td>{job.endTimeAdministrator || '—'}</td>
                        <td>
                          {formatJobReconciliationTravellingCharges(job.projectTravellingCharges, t)}
                        </td>
                        <td>{formatJobTravellingChargeAmount(job.travellingChargesSystem)}</td>
                        <td>{formatJobTravellingChargeAmount(job.travellingChargesAdministrator)}</td>
                        <td>{formatJobReconciliationStatus(job.reconciliationStatus, t)}</td>
                        {canWrite ? (
                          <td className="table-actions">
                            <button
                              type="button"
                              className="btn-link"
                              disabled={!canEditJob(job.status)}
                              onClick={() => {
                                setSelectedJobId(job.id);
                                setFormMode('edit');
                                setSuccess('');
                              }}
                            >
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              className="btn-link"
                              disabled={!canAcceptJob(job.status) || acceptingId === job.id}
                              onClick={() => void handleAccept(job.id)}
                            >
                              {acceptingId === job.id ? t('saving') : t('jobReconciliationAccept')}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-pagination financials-pagination">
              <span className="pagination-summary">
                {t('showingEntries')
                  .replace('{from}', String(pageStart))
                  .replace('{to}', String(pageEnd))
                  .replace('{total}', String(totalEntries))}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPage <= 1 || totalEntries === 0}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {t('previous')}
                </button>
                <span>
                  {t('page')} {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPage >= totalPages || totalEntries === 0}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  {t('next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
