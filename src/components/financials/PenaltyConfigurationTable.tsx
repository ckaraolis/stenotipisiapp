import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePenaltyConfiguration,
  fetchPenaltyConfigurationRecords,
  fetchPenaltyStenotypistCandidates,
} from '../../api/stenotypistPenalty';
import {
  formatPenaltyConfigurationStenotypistLabel,
  formatPenaltyCurrency,
  formatPenaltyTargetHours,
  parsePenaltyConfigurationDeleteError,
} from '../../config/stenotypistPenalty';
import { downloadPenaltyConfigurationsImportTemplate } from '../../config/stenotypistPenaltyImport';
import type {
  StenotypistPenaltyCandidate,
  StenotypistPenaltyConfigurationRecord,
  StenotypistPenaltyImportResult,
} from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatDateDisplay } from '../../utils/dateFormat';
import DeletePenaltyConfigurationDialog from './DeletePenaltyConfigurationDialog';
import ImportPenaltyConfigurationsDialog from './ImportPenaltyConfigurationsDialog';
import PenaltyConfigurationForm from './PenaltyConfigurationForm';
import '../../styles/financials.css';
import '../../styles/profile.css';
import '../../styles/projects.css';
import '../../styles/dashboard.css';
import DateInput from '../common/DateInput';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

export default function PenaltyConfigurationTable() {
  const { t } = useLanguage();

  const [configurations, setConfigurations] = useState<StenotypistPenaltyConfigurationRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<StenotypistPenaltyCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [applicableDateFrom, setApplicableDateFrom] = useState('');
  const [applicableDateTo, setApplicableDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StenotypistPenaltyConfigurationRecord | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const resetPage = () => setPage(1);

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchPenaltyConfigurationRecords({
        stenotypistUserId,
        dateFrom: applicableDateFrom,
        dateTo: applicableDateTo,
      });
      setConfigurations(rows);
    } catch {
      setError(t('penaltyConfigurationLoadError'));
    } finally {
      setLoading(false);
    }
  }, [applicableDateFrom, applicableDateTo, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchPenaltyStenotypistCandidates()
      .then((rows) => {
        if (active) setStenotypists(rows);
      })
      .catch(() => {
        if (active) setError(t('penaltyConfigurationLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...configurations]
      .filter((row) => {
        if (!query) return true;
        const label = formatPenaltyConfigurationStenotypistLabel(
          row.stenotypistFullName,
          row.stenotypistUsername,
        ).toLowerCase();
        return label.includes(query);
      })
      .sort((a, b) => {
        const nameCmp = a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
          sensitivity: 'base',
        });
        const ordered = sortDirection === 'asc' ? nameCmp : -nameCmp;
        if (ordered !== 0) return ordered;
        return b.validFrom.localeCompare(a.validFrom);
      });
  }, [configurations, searchQuery, sortDirection]);

  const totalEntries = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSaved = (message: string, options?: { keepOpen?: boolean }) => {
    if (!options?.keepOpen) {
      setFormMode('closed');
      setSelectedConfigurationId(null);
    }
    setSuccess(message);
    void loadConfigurations();
  };

  const handleImported = (summary: StenotypistPenaltyImportResult) => {
    setShowImport(false);
    let message = t('penaltyConfigurationImportSuccess')
      .replace('{created}', String(summary.created))
      .replace('{updated}', String(summary.updated))
      .replace('{skipped}', String(summary.skipped));
    if (summary.errors?.length) {
      const samples = summary.errors
        .slice(0, 3)
        .map((item) => {
          const reason = t(item.message as TranslationKey);
          return `row ${item.row}: ${reason === item.message ? item.message : reason}${
            item.detail ? ` (${item.detail})` : ''
          }`;
        })
        .join('; ');
      message = `${message} ${t('penaltyConfigurationImportSkipReasons').replace(
        '{reasons}',
        samples,
      )}`;
    }
    setSuccess(message);
    setError('');
    void loadConfigurations();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deletePenaltyConfiguration(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('penaltyConfigurationDeletedSuccess'));
      await loadConfigurations();
    } catch (err) {
      setDeleteError(parsePenaltyConfigurationDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="financials-page">
      <div className="page-header financials-header customers-header">
        <div>
          <h1 className="page-title">{t('penaltyConfiguration')}</h1>
          <p className="page-subtitle">{t('penaltyConfigurationSubtitle')}</p>
        </div>
        <div className="customers-header-actions">
          <button
            type="button"
            className="profile-cancel-btn"
            onClick={downloadPenaltyConfigurationsImportTemplate}
          >
            {t('downloadImportTemplate')}
          </button>
          <button type="button" className="profile-cancel-btn" onClick={() => setShowImport(true)}>
            {t('importFromExcel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormMode('create');
              setSelectedConfigurationId(null);
              setSuccess('');
            }}
          >
            {t('addNew')}
          </button>
        </div>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

        <div className="filters">
          <div className="filters-row">
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
                    {formatPenaltyConfigurationStenotypistLabel(
                      stenotypist.fullName,
                      stenotypist.username,
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label className="date-field">
              <span>{t('dateFrom')}</span>
              <DateInput
                value={applicableDateFrom}
                onChange={(event) => {
                  setApplicableDateFrom(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label className="date-field">
              <span>{t('dateTo')}</span>
              <DateInput
                value={applicableDateTo}
                onChange={(event) => {
                  setApplicableDateTo(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <div className="filters-actions">
              <input
                type="search"
                className="search-input"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  resetPage();
                }}
              />
              <button
                type="button"
                className="refresh-btn"
                aria-label={t('refresh')}
                onClick={() => void loadConfigurations()}
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrapper financials-table-wrapper">
          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <table className="financials-table">
              <thead>
                <tr>
                  <th className="sorted-col">
                    <button
                      type="button"
                      className="sort-header-btn"
                      onClick={() => {
                        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
                        resetPage();
                      }}
                    >
                      {t('stenotypist')}
                      <SortIcon direction={sortDirection} />
                    </button>
                  </th>
                  <th>{t('targetHoursBeforeDeadline')}</th>
                  <th>{t('penaltyPerHourLate')}</th>
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
                        {formatPenaltyConfigurationStenotypistLabel(
                          row.stenotypistFullName,
                          row.stenotypistUsername,
                        )}
                      </td>
                      <td>{formatPenaltyTargetHours(row.targetHoursBeforeDeadline)}</td>
                      <td>{formatPenaltyCurrency(row.penaltyPerHourLate)}</td>
                      <td>{formatDateDisplay(row.validFrom)}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setFormMode('edit');
                              setSelectedConfigurationId(row.id);
                              setSuccess('');
                            }}
                          >
                            {t('edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(row);
                              setDeleteError('');
                            }}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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
      </div>

      {formMode !== 'closed' ? (
        <PenaltyConfigurationForm
          mode={formMode}
          configurationId={selectedConfigurationId ?? undefined}
          onCancel={() => {
            setFormMode('closed');
            setSelectedConfigurationId(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {showImport ? (
        <ImportPenaltyConfigurationsDialog
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      ) : null}

      {deleteTarget ? (
        <DeletePenaltyConfigurationDialog
          configuration={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError('');
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="sort-icon"
      style={{ transform: direction === 'desc' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M7 14l5-5 5 5z" />
    </svg>
  );
}
