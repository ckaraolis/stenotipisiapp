import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePenaltyConfiguration,
  fetchPenaltyConfigurationRecords,
} from '../../api/stenotypistPenalty';
import {
  formatPenaltyCurrency,
  formatPenaltyGracePeriodHours,
  parsePenaltyConfigurationDeleteError,
} from '../../config/stenotypistPenalty';
import type { StenotypistPenaltyConfigurationRecord } from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import DeletePenaltyConfigurationDialog from './DeletePenaltyConfigurationDialog';
import PenaltyConfigurationForm from './PenaltyConfigurationForm';
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

export default function PenaltyConfigurationTable() {
  const { t } = useLanguage();
  const today = getTodayDate();

  const [configurations, setConfigurations] = useState<StenotypistPenaltyConfigurationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [applicableDateFrom, setApplicableDateFrom] = useState(today);
  const [applicableDateTo, setApplicableDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StenotypistPenaltyConfigurationRecord | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchPenaltyConfigurationRecords({
        dateFrom: applicableDateFrom,
        dateTo: applicableDateTo,
      });
      setConfigurations(rows);
    } catch {
      setError(t('penaltyConfigurationLoadError'));
    } finally {
      setLoading(false);
    }
  }, [applicableDateFrom, applicableDateTo, t]);

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

  if (formMode !== 'closed') {
    return (
      <PenaltyConfigurationForm
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
          <h1 className="page-title">{t('penaltyConfiguration')}</h1>
          <p className="page-subtitle">{t('penaltyConfigurationSubtitle')}</p>
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
              <span>{t('applicableDateFrom')}</span>
              <input
                type="date"
                value={applicableDateFrom}
                onChange={(event) => {
                  setApplicableDateFrom(event.target.value);
                  setPage(1);
                  setSuccess('');
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
                  setSuccess('');
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
                  <th>{t('penaltyGracePeriodHours')}</th>
                  <th>{t('penaltyBaseAmountEur')}</th>
                  <th>{t('penaltyExtraPerHourEur')}</th>
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
                      <td>{formatPenaltyGracePeriodHours(row.gracePeriodHours)}</td>
                      <td>{formatPenaltyCurrency(row.basePenalty)}</td>
                      <td>{formatPenaltyCurrency(row.extraPenaltyPerHour)}</td>
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
