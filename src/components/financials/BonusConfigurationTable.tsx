import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteBonusConfiguration,
  fetchBonusConfigurationRecords,
  fetchBonusStenotypistCandidates,
} from '../../api/stenotypistBonus';
import {
  formatBonusBaseHours,
  formatBonusConfigurationStenotypistLabel,
  formatBonusPerExtraHour,
  parseBonusConfigurationDeleteError,
} from '../../config/stenotypistBonus';
import type {
  StenotypistBonusCandidate,
  StenotypistBonusConfigurationRecord,
} from '../../types/stenotypistBonus';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import BonusConfigurationForm from './BonusConfigurationForm';
import DeleteBonusConfigurationDialog from './DeleteBonusConfigurationDialog';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function BonusConfigurationTable() {
  const { t } = useLanguage();
  const today = getTodayDate();

  const [configurations, setConfigurations] = useState<StenotypistBonusConfigurationRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<StenotypistBonusCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [applicableDateFrom, setApplicableDateFrom] = useState(today);
  const [applicableDateTo, setApplicableDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StenotypistBonusConfigurationRecord | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchBonusConfigurationRecords({
        stenotypistUserId,
        dateFrom: applicableDateFrom,
        dateTo: applicableDateTo,
      });
      setConfigurations(rows);
    } catch {
      setError(t('bonusConfigurationLoadError'));
    } finally {
      setLoading(false);
    }
  }, [applicableDateFrom, applicableDateTo, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchBonusStenotypistCandidates()
      .then((rows) => {
        if (active) setStenotypists(rows);
      })
      .catch(() => {
        if (active) setError(t('bonusConfigurationLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  const sortedRows = useMemo(
    () => [...configurations].sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
    [configurations],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSaved = (message: string) => {
    setFormMode('closed');
    setSelectedConfigurationId(null);
    setSuccess(message);
    void loadConfigurations();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteBonusConfiguration(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('bonusConfigurationDeletedSuccess'));
      await loadConfigurations();
    } catch (err) {
      setDeleteError(parseBonusConfigurationDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  if (formMode !== 'closed') {
    return (
      <BonusConfigurationForm
        mode={formMode}
        configurationId={selectedConfigurationId ?? undefined}
        onCancel={() => {
          setFormMode('closed');
          setSelectedConfigurationId(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('bonusConfiguration')}</h1>
          <p className="page-subtitle">{t('stenotypistBonusSubtitle')}</p>
        </div>
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
                  setPage(1);
                }}
              >
                <option value="">{t('allStenotypists')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {formatBonusConfigurationStenotypistLabel(
                      stenotypist.fullName,
                      stenotypist.username,
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('applicableDateFrom')}</span>
              <input
                type="date"
                value={applicableDateFrom}
                onChange={(event) => {
                  setApplicableDateFrom(event.target.value);
                  setPage(1);
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
                  setPage(1);
                }}
              />
            </label>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <p>{t('loading')}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('stenotypist')}</th>
                  <th>{t('infoBaseHours')}</th>
                  <th>{t('bonusPerExtraHourEur')}</th>
                  <th>{t('validFrom')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t('noRecordsFound')}</td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {formatBonusConfigurationStenotypistLabel(
                          row.stenotypistFullName,
                          row.stenotypistUsername,
                        )}
                      </td>
                      <td>{formatBonusBaseHours(row.baseHours)}</td>
                      <td>{formatBonusPerExtraHour(row.bonusPerExtraHour)}</td>
                      <td>{formatDateDisplay(row.validFrom)}</td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="btn-link"
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
                          className="btn-link"
                          onClick={() => {
                            setDeleteTarget(row);
                            setDeleteError('');
                          }}
                        >
                          {t('delete')}
                        </button>
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

      {deleteTarget ? (
        <DeleteBonusConfigurationDialog
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
