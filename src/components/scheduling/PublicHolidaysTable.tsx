import { useCallback, useEffect, useMemo, useState } from 'react';
import { deletePublicHoliday, fetchPublicHolidayRecords } from '../../api/publicHolidays';
import type { PublicHolidayRecord } from '../../types/publicHoliday';
import DeletePublicHolidayDialog, {
  parsePublicHolidayDeleteError,
} from './DeletePublicHolidayDialog';
import PublicHolidayDetailsForm from './PublicHolidayDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';
type DateRangePreset = 'thisYear' | 'all' | 'custom';

function getThisYearBounds(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

export default function PublicHolidaysTable() {
  const { t } = useLanguage();
  const thisYearBounds = getThisYearBounds();
  const [holidays, setHolidays] = useState<PublicHolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedHolidayId, setSelectedHolidayId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicHolidayRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('thisYear');
  const [dateFrom, setDateFrom] = useState(thisYearBounds.from);
  const [dateTo, setDateTo] = useState(thisYearBounds.to);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPublicHolidayRecords();
      setHolidays(data);
    } catch {
      setError(t('publicHolidaysLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const filteredRows = useMemo(() => {
    if (rangePreset === 'all') {
      return holidays;
    }

    const from = rangePreset === 'thisYear' ? getThisYearBounds().from : dateFrom;
    const to = rangePreset === 'thisYear' ? getThisYearBounds().to : dateTo;

    return holidays.filter((row) => row.date >= from && row.date <= to);
  }, [holidays, rangePreset, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = a.date.localeCompare(b.date);
      if (comparison !== 0) {
        return sortDirection === 'desc' ? -comparison : comparison;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
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
    if (preset === 'thisYear') {
      const bounds = getThisYearBounds();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
    resetPage();
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedHolidayId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (holidayId: string) => {
    setFormMode('edit');
    setSelectedHolidayId(holidayId);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedHolidayId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedHolidayId(null);
    setSuccess(message);
    await loadHolidays();
  };

  const handleDeleteRequest = (holiday: PublicHolidayRecord) => {
    setDeleteError('');
    setDeleteTarget(holiday);
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
      await deletePublicHoliday(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('publicHolidayDeletedSuccess'));
      await loadHolidays();
    } catch (err) {
      setDeleteError(parsePublicHolidayDeleteError((err as Error).message, t));
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
          <h1 className="page-title">{t('publicHolidays')}</h1>
          <p className="page-subtitle">{t('publicHolidaysSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <PublicHolidayDetailsForm
          mode={formMode}
          holidayId={selectedHolidayId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeletePublicHolidayDialog
          holidayName={deleteTarget.name}
          holidayDate={deleteTarget.date}
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
                <select
                  value={rangePreset}
                  onChange={(event) =>
                    handleRangePresetChange(event.target.value as DateRangePreset)
                  }
                >
                  <option value="thisYear">{t('thisYear')}</option>
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
                          {t('holidayDate')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('holidayName')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.date}</td>
                          <td>{row.name}</td>
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
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}
