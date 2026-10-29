import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteTravellingTime,
  fetchTravellingTimeRecords,
} from '../../api/travellingTimes';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { TravellingTimeRecord } from '../../types/travellingTime';
import DeleteTravellingTimeDialog, {
  parseTravellingTimeDeleteError,
} from './DeleteTravellingTimeDialog';
import TravellingTimeDetailsForm from './TravellingTimeDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function districtSortKey(row: TravellingTimeRecord): string {
  return formatDistrictLabel({
    districtName: row.district1Name,
    districtAlias: row.district1Alias,
  });
}

export default function TravellingTimesTable() {
  const { t } = useLanguage();
  const today = getTodayDate();

  const [trips, setTrips] = useState<TravellingTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravellingTimeRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [applicableDateFrom, setApplicableDateFrom] = useState(today);
  const [applicableDateTo, setApplicableDateTo] = useState(today);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTravellingTimeRecords();
      setTrips(data);
    } catch {
      setError(t('travellingTimesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const filteredRows = useMemo(() => {
    const from = applicableDateFrom;
    const to = applicableDateTo;

    return trips.filter((row) => row.validityFrom >= from && row.validityFrom <= to);
  }, [trips, applicableDateFrom, applicableDateTo]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = districtSortKey(a).localeCompare(districtSortKey(b), undefined, {
        sensitivity: 'base',
      });
      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return a.district2Name.localeCompare(b.district2Name, undefined, { sensitivity: 'base' });
    });
  }, [filteredRows, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedTripId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (tripId: string) => {
    setFormMode('edit');
    setSelectedTripId(tripId);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedTripId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedTripId(null);
    setSuccess(message);
    await loadTrips();
  };

  const handleDeleteRequest = (trip: TravellingTimeRecord) => {
    setDeleteError('');
    setDeleteTarget(trip);
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
      await deleteTravellingTime(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('travellingTimeDeletedSuccess'));
      await loadTrips();
    } catch (err) {
      setDeleteError(parseTravellingTimeDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    resetPage();
  };

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('travellingTime')}</h1>
          <p className="page-subtitle">{t('travellingTimesSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <TravellingTimeDetailsForm
          mode={formMode}
          tripId={selectedTripId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteTravellingTimeDialog
          trip={deleteTarget}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {formMode === 'closed' && (
        <div className="projects-panel">
          <div className="filters">
            <div className="filters-row">
              <label className="filter-select">
                <span>{t('applicableDateFrom')}</span>
                <input
                  type="date"
                  value={applicableDateFrom}
                  onChange={(event) => {
                    setApplicableDateFrom(event.target.value);
                    resetPage();
                  }}
                />
              </label>
              <label className="filter-select">
                <span>{t('applicableDateTo')}</span>
                <input
                  type="date"
                  value={applicableDateTo}
                  onChange={(event) => {
                    setApplicableDateTo(event.target.value);
                    resetPage();
                  }}
                />
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
                      <th className="sorted-col">
                        <button type="button" className="sort-header-btn" onClick={toggleSort}>
                          {t('district1')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('district2')}</th>
                      <th>{t('travellingTime')}</th>
                      <th>{t('validityFrom')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {formatDistrictLabel({
                              districtName: row.district1Name,
                              districtAlias: row.district1Alias,
                            })}
                          </td>
                          <td>
                            {formatDistrictLabel({
                              districtName: row.district2Name,
                              districtAlias: row.district2Alias,
                            })}
                          </td>
                          <td>{row.travellingTime}</td>
                          <td>{row.validityFrom}</td>
                          <td className="actions-col">
                            <div className="row-actions">
                              <button type="button" onClick={() => handleOpenEdit(row.id)}>
                                {t('edit')}
                              </button>
                              <button type="button" onClick={() => handleDeleteRequest(row)}>
                                {t('delete')}
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
