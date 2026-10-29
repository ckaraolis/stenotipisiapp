import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteStenotypistLeave,
  fetchStenotypistLeaveCandidates,
  fetchStenotypistLeaveRecords,
  updateStenotypistLeaveStatus,
  type StenotypistLeaveCandidate,
} from '../../api/stenotypistLeaves';
import {
  STENOTYPIST_LEAVE_REASON_OPTIONS,
  STENOTYPIST_LEAVE_STATUS_OPTIONS,
  formatRequestedOn,
  formatStenotypistLeaveLabel,
  stenotypistLeaveReasonLabelKey,
  stenotypistLeaveStatusLabelKey,
} from '../../config/stenotypistLeave';
import {
  canManageStenotypistLeaveForOthers,
  isStenotypistLeaveSelfServiceOnly,
} from '../../config/permissions';
import type { StenotypistLeaveRecord } from '../../types/stenotypistLeave';
import { getAuthUser } from '../../utils/auth';
import DeleteStenotypistLeaveDialog, {
  parseStenotypistLeaveDeleteError,
} from './DeleteStenotypistLeaveDialog';
import StenotypistLeaveDetailsForm from './StenotypistLeaveDetailsForm';
import StenotypistLeaveHistoryDialog from './StenotypistLeaveHistoryDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';
type DateRangePreset = 'toYearEnd' | 'all' | 'custom';

function getDefaultLeaveListDateRange(): { from: string; to: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return {
    from: `${year}-${month}-${day}`,
    to: `${year}-12-31`,
  };
}

function parseStatusUpdateError(message: string, t: (key: TranslationKey) => string): string {
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

export default function StenotypistLeavesTable() {
  const { t } = useLanguage();
  const defaultRange = getDefaultLeaveListDateRange();
  const authUser = getAuthUser();
  const userRoles = authUser?.roles ?? authUser?.role;
  const manageAllStenotypists = useMemo(
    () => canManageStenotypistLeaveForOthers(userRoles),
    [userRoles],
  );
  const selfServiceOnly = useMemo(
    () => isStenotypistLeaveSelfServiceOnly(userRoles),
    [userRoles],
  );

  const [leaves, setLeaves] = useState<StenotypistLeaveRecord[]>([]);
  const [stenotypistOptions, setStenotypistOptions] = useState<StenotypistLeaveCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StenotypistLeaveRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<StenotypistLeaveRecord | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('toYearEnd');
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [stenotypistFilter, setStenotypistFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, candidates] = await Promise.all([
        fetchStenotypistLeaveRecords(),
        fetchStenotypistLeaveCandidates(),
      ]);
      setLeaves(data);
      setStenotypistOptions(candidates);
    } catch {
      setError(t('stenotypistLeavesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const filteredRows = useMemo(() => {
    const from =
      rangePreset === 'toYearEnd' ? getDefaultLeaveListDateRange().from : dateFrom;
    const to = rangePreset === 'toYearEnd' ? getDefaultLeaveListDateRange().to : dateTo;

    return leaves.filter((row) => {
      if (rangePreset !== 'all') {
        if (row.dateFrom < from || row.dateFrom > to) {
          return false;
        }
      }

      if (stenotypistFilter !== 'all' && row.stenotypistUserId !== stenotypistFilter) {
        return false;
      }

      if (reasonFilter !== 'all' && row.reason !== reasonFilter) {
        return false;
      }

      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [leaves, rangePreset, dateFrom, dateTo, stenotypistFilter, reasonFilter, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = a.dateFrom.localeCompare(b.dateFrom);
      if (comparison !== 0) {
        return sortDirection === 'desc' ? -comparison : comparison;
      }
      return formatStenotypistLeaveLabel(a).localeCompare(
        formatStenotypistLeaveLabel(b),
        undefined,
        { sensitivity: 'base' },
      );
    });
  }, [filteredRows, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const handleRangePresetChange = (preset: DateRangePreset) => {
    setRangePreset(preset);
    if (preset === 'toYearEnd') {
      const bounds = getDefaultLeaveListDateRange();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
    resetPage();
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedLeaveId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (leaveId: string) => {
    setFormMode('edit');
    setSelectedLeaveId(leaveId);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedLeaveId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedLeaveId(null);
    setSuccess(message);
    await loadLeaves();
  };

  const handleDeleteRequest = (leave: StenotypistLeaveRecord) => {
    setDeleteError('');
    setDeleteTarget(leave);
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
      await deleteStenotypistLeave(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('stenotypistLeaveDeletedSuccess'));
      await loadLeaves();
    } catch (err) {
      setDeleteError(parseStenotypistLeaveDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (leave: StenotypistLeaveRecord) => {
    setStatusUpdatingId(leave.id);
    setError('');
    setSuccess('');
    try {
      await updateStenotypistLeaveStatus(leave.id, 'approved');
      setSuccess(t('stenotypistLeaveApprovedSuccess'));
      await loadLeaves();
    } catch (err) {
      setError(parseStatusUpdateError((err as Error).message, t));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleReject = async (leave: StenotypistLeaveRecord) => {
    setStatusUpdatingId(leave.id);
    setError('');
    setSuccess('');
    try {
      await updateStenotypistLeaveStatus(leave.id, 'rejected');
      setSuccess(t('stenotypistLeaveRejectedSuccess'));
      await loadLeaves();
    } catch (err) {
      setError(parseStatusUpdateError((err as Error).message, t));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    resetPage();
  };

  const showStatusActions = (row: StenotypistLeaveRecord) =>
    manageAllStenotypists && row.status === 'new';

  const showEdit = (row: StenotypistLeaveRecord) =>
    manageAllStenotypists || row.status === 'new';

  const showDelete = showEdit;

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('stenotypistLeave')}</h1>
          <p className="page-subtitle">{t('stenotypistLeavesSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <StenotypistLeaveDetailsForm
          mode={formMode}
          leaveId={selectedLeaveId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteStenotypistLeaveDialog
          leave={deleteTarget}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {historyTarget && (
        <StenotypistLeaveHistoryDialog leave={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      {formMode === 'closed' && (
        <div className="projects-panel">
          <div className="filters">
            <div className="filters-row">
              <label className="filter-select">
                <select
                  value={rangePreset}
                  onChange={(event) =>
                    handleRangePresetChange(event.target.value as DateRangePreset)
                  }
                >
                  <option value="toYearEnd">{t('fromTodayToYearEnd')}</option>
                  <option value="all">{t('allDates')}</option>
                  <option value="custom">{t('customDateRange')}</option>
                </select>
              </label>

              {rangePreset === 'custom' && (
                <>
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
                </>
              )}

              <label className="filter-select">
                <select
                  value={reasonFilter}
                  onChange={(event) => {
                    setReasonFilter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="all">{t('allReasons')}</option>
                  {STENOTYPIST_LEAVE_REASON_OPTIONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {t(stenotypistLeaveReasonLabelKey(reason))}
                    </option>
                  ))}
                </select>
              </label>

              {!selfServiceOnly && (
                <label className="filter-select">
                  <select
                    value={stenotypistFilter}
                    onChange={(event) => {
                      setStenotypistFilter(event.target.value);
                      resetPage();
                    }}
                  >
                    <option value="all">{t('allStenotypists')}</option>
                    {stenotypistOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.username} – {candidate.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="filter-select">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="all">{t('allStatuses')}</option>
                  {STENOTYPIST_LEAVE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {t(stenotypistLeaveStatusLabelKey(status))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="projects-table">
                  <thead>
                    <tr>
                      <th>{t('stenotypist')}</th>
                      <th className="sorted-col">
                        <button type="button" className="sort-header-btn" onClick={toggleSort}>
                          {t('dateFrom')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('dateTo')}</th>
                      <th>{t('reason')}</th>
                      <th>{t('status')}</th>
                      <th>{t('requestedBy')}</th>
                      <th>{t('requestedOn')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatStenotypistLeaveLabel(row)}</td>
                          <td>{row.dateFrom}</td>
                          <td>{row.dateTo}</td>
                          <td>
                            {row.reason ? t(stenotypistLeaveReasonLabelKey(row.reason)) : '—'}
                          </td>
                          <td>{t(stenotypistLeaveStatusLabelKey(row.status))}</td>
                          <td>{row.createdByName || '—'}</td>
                          <td>{formatRequestedOn(row.createdAt)}</td>
                          <td className="actions-col">
                            <div className="row-actions">
                              {showEdit(row) && (
                                <button type="button" onClick={() => handleOpenEdit(row.id)}>
                                  {t('edit')}
                                </button>
                              )}
                              {showDelete(row) && (
                                <button type="button" onClick={() => handleDeleteRequest(row)}>
                                  {t('delete')}
                                </button>
                              )}
                              {showStatusActions(row) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={statusUpdatingId === row.id}
                                    onClick={() => void handleApprove(row)}
                                  >
                                    {t('approve')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={statusUpdatingId === row.id}
                                    onClick={() => void handleReject(row)}
                                  >
                                    {t('reject')}
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => setHistoryTarget(row)}>
                                {t('viewHistory')}
                              </button>
                            </div>
                          </td>
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
                    onClick={() => setPage(1)}
                  >
                    {t('first')}
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage <= 1 || totalEntries === 0}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    {t('previous')}
                  </button>
                  <span className="pagination-page">{currentPage}</span>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage >= totalPages || totalEntries === 0}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t('next')}
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage >= totalPages || totalEntries === 0}
                    onClick={() => setPage(totalPages)}
                  >
                    {t('last')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`sort-icon${direction === 'desc' ? ' sort-icon-desc' : ''}`}
    >
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}
