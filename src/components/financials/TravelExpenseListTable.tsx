import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveJobTravelExpense,
  fetchJobTravelExpenseCandidates,
  fetchJobTravelExpenseRecords,
  rejectJobTravelExpense,
} from '../../api/jobTravelExpenses';
import {
  formatJobDateDdMmYy,
  formatJobTravelExpenseStenotypistLabel,
  formatProjectDistrictLabel,
  formatTravelExpenseListAmount,
  getPreviousMonthDateRange,
  JOB_TRAVEL_EXPENSES_PAGE_SIZE,
  parseJobTravelExpenseActionError,
  TRAVEL_EXPENSE_STATUS_OPTIONS,
  travelExpenseStatusLabelKey,
} from '../../config/jobTravelExpenses';
import { isStenotypistTravelExpenseSelfServiceOnly } from '../../config/permissions';
import type {
  JobTravelExpenseCandidate,
  JobTravelExpenseRecord,
  TravelExpenseStatus,
} from '../../types/jobTravelExpenses';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser } from '../../utils/auth';
import '../../styles/financials.css';

type DateRangePreset = 'previousMonth' | 'custom';

export default function TravelExpenseListTable() {
  const { t } = useLanguage();
  const previousMonthBounds = getPreviousMonthDateRange();
  const authUser = getAuthUser();
  const selfServiceOnly = isStenotypistTravelExpenseSelfServiceOnly(authUser?.roles ?? authUser?.role);

  const [expenses, setExpenses] = useState<JobTravelExpenseRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<JobTravelExpenseCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [actingJobId, setActingJobId] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('previousMonth');
  const [dateFrom, setDateFrom] = useState(previousMonthBounds.from);
  const [dateTo, setDateTo] = useState(previousMonthBounds.to);
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [status, setStatus] = useState<TravelExpenseStatus | ''>('pending');
  const [page, setPage] = useState(1);

  const activeDateFrom =
    rangePreset === 'previousMonth' ? getPreviousMonthDateRange().from : dateFrom;
  const activeDateTo = rangePreset === 'previousMonth' ? getPreviousMonthDateRange().to : dateTo;

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchJobTravelExpenseRecords({
        stenotypistUserId,
        status,
        dateFrom: activeDateFrom,
        dateTo: activeDateTo,
      });
      setExpenses(rows);
    } catch {
      setError(t('jobTravelExpenseLoadError'));
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo, status, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchJobTravelExpenseCandidates()
      .then((rows) => {
        if (!active) return;
        setStenotypists(rows);
        if (selfServiceOnly && rows.length === 1) {
          setStenotypistUserId(rows[0].id);
        }
      })
      .catch(() => {
        if (active) setError(t('jobTravelExpenseLoadError'));
      });
    return () => {
      active = false;
    };
  }, [selfServiceOnly, t]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const sortedRows = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        if (a.jobDate !== b.jobDate) return a.jobDate.localeCompare(b.jobDate);
        return a.jobNumber.localeCompare(b.jobNumber);
      }),
    [expenses],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / JOB_TRAVEL_EXPENSES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * JOB_TRAVEL_EXPENSES_PAGE_SIZE + 1;
  const pageEnd =
    totalEntries === 0 ? 0 : Math.min(currentPage * JOB_TRAVEL_EXPENSES_PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * JOB_TRAVEL_EXPENSES_PAGE_SIZE,
    currentPage * JOB_TRAVEL_EXPENSES_PAGE_SIZE,
  );

  function handleRangePresetChange(preset: DateRangePreset) {
    setRangePreset(preset);
    setPage(1);
    if (preset === 'previousMonth') {
      const bounds = getPreviousMonthDateRange();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
  }

  const handleApprove = async (row: JobTravelExpenseRecord) => {
    setActingJobId(row.jobId);
    setActionError('');
    setSuccess('');
    try {
      await approveJobTravelExpense(row.jobId);
      setSuccess(t('jobTravelExpenseApprovedSuccess'));
      await loadExpenses();
    } catch (err) {
      setActionError(parseJobTravelExpenseActionError((err as Error).message, t));
    } finally {
      setActingJobId(null);
    }
  };

  const handleReject = async (row: JobTravelExpenseRecord) => {
    setActingJobId(row.jobId);
    setActionError('');
    setSuccess('');
    try {
      await rejectJobTravelExpense(row.jobId);
      setSuccess(t('jobTravelExpenseRejectedSuccess'));
      await loadExpenses();
    } catch (err) {
      setActionError(parseJobTravelExpenseActionError((err as Error).message, t));
    } finally {
      setActingJobId(null);
    }
  };

  return (
    <div className="financials-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('travelExpenseList')}</h1>
          <p className="page-subtitle">{t('travelExpenseListSubtitle')}</p>
        </div>
      </header>

      <section className="financials-filters card">
        <div className="filter-grid">
          <label className="filter-field">
            <span>{t('dateRange')}</span>
            <select
              value={rangePreset}
              onChange={(event) => handleRangePresetChange(event.target.value as DateRangePreset)}
            >
              <option value="previousMonth">{t('previousMonth')}</option>
              <option value="custom">{t('customRange')}</option>
            </select>
          </label>

          {rangePreset === 'custom' ? (
            <>
              <label className="filter-field">
                <span>{t('dateFrom')}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="filter-field">
                <span>{t('dateTo')}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </>
          ) : null}

          <label className="filter-field">
            <span>{t('stenotypist')}</span>
            <select
              value={stenotypistUserId}
              disabled={selfServiceOnly}
              onChange={(event) => {
                setStenotypistUserId(event.target.value);
                setPage(1);
              }}
            >
              {!selfServiceOnly ? <option value="">{t('allStenotypists')}</option> : null}
              {stenotypists.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatJobTravelExpenseStenotypistLabel(candidate)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{t('travelExpenseStatus')}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TravelExpenseStatus | '');
                setPage(1);
              }}
            >
              <option value="">{t('allStatuses')}</option>
              {TRAVEL_EXPENSE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(travelExpenseStatusLabelKey(option))}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}
      {actionError ? <div className="profile-alert profile-alert-error">{actionError}</div> : null}
      {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

      <section className="card financials-table-card">
        {loading ? (
          <p className="loading-text">{t('loading')}</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('stenotypist')}</th>
                    <th>{t('travelExpenseProjectDistrict')}</th>
                    <th>{t('customerAlias')}</th>
                    <th>{t('project')}</th>
                    <th>{t('jobNumber')}</th>
                    <th>{t('jobDate')}</th>
                    <th>{t('travelExpenseAmount')}</th>
                    <th>{t('travelExpenseStatus')}</th>
                    {!selfServiceOnly ? <th>{t('actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={selfServiceOnly ? 8 : 9} className="empty-table-cell">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {formatJobTravelExpenseStenotypistLabel({
                            fullName: row.stenotypistFullName,
                            username: row.stenotypistUsername,
                          })}
                        </td>
                        <td>
                          {formatProjectDistrictLabel(
                            row.projectDistrictName,
                            row.projectDistrictAlias,
                          )}
                        </td>
                        <td>{row.customerAlias || '—'}</td>
                        <td>{row.projectLabel}</td>
                        <td>{row.jobNumber}</td>
                        <td>{formatJobDateDdMmYy(row.jobDate)}</td>
                        <td>{formatTravelExpenseListAmount(row.amount)}</td>
                        <td>{t(travelExpenseStatusLabelKey(row.status))}</td>
                        {!selfServiceOnly ? (
                          <td className="table-actions">
                            {row.status === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-link"
                                  disabled={actingJobId === row.jobId}
                                  onClick={() => void handleApprove(row)}
                                >
                                  {t('approve')}
                                </button>
                                <button
                                  type="button"
                                  className="btn-link"
                                  disabled={actingJobId === row.jobId}
                                  onClick={() => void handleReject(row)}
                                >
                                  {t('reject')}
                                </button>
                              </>
                            ) : (
                              '—'
                            )}
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
      </section>
    </div>
  );
}
