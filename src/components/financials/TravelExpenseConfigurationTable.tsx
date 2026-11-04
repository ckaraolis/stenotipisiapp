import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDistrictOptions } from '../../api/districts';
import {
  deleteTravelExpense,
  fetchTravelExpenseRecords,
  fetchTravelExpenseStenotypistCandidates,
} from '../../api/travelExpenses';
import {
  formatTravelExpenseAmount,
  formatTravelExpenseDistrictLabel,
  formatTravelExpenseStenotypistLabel,
  parseTravelExpenseDeleteError,
} from '../../config/travelExpenses';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type {
  TravelExpenseCandidate,
  TravelExpenseConfigurationRecord,
} from '../../types/travelExpenses';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import DeleteTravelExpenseDialog from './DeleteTravelExpenseDialog';
import TravelExpenseConfigurationForm from './TravelExpenseConfigurationForm';
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

export default function TravelExpenseConfigurationTable() {
  const { t } = useLanguage();
  const today = getTodayDate();

  const [configurations, setConfigurations] = useState<TravelExpenseConfigurationRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<TravelExpenseCandidate[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [applicableDateFrom, setApplicableDateFrom] = useState(today);
  const [applicableDateTo, setApplicableDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelExpenseConfigurationRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchTravelExpenseRecords({
        stenotypistUserId,
        districtId,
        dateFrom: applicableDateFrom,
        dateTo: applicableDateTo,
      });
      setConfigurations(rows);
    } catch {
      setError(t('travelExpenseLoadError'));
    } finally {
      setLoading(false);
    }
  }, [applicableDateFrom, applicableDateTo, districtId, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTravelExpenseStenotypistCandidates(), fetchDistrictOptions()])
      .then(([stenotypistRows, districtRows]) => {
        if (!active) return;
        setStenotypists(stenotypistRows);
        setDistricts(districtRows);
      })
      .catch(() => {
        if (active) setError(t('travelExpenseLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  const sortedRows = useMemo(
    () =>
      [...configurations].sort(
        (a, b) =>
          a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
            sensitivity: 'base',
          }) ||
          a.districtName.localeCompare(b.districtName, undefined, { sensitivity: 'base' }) ||
          b.validFrom.localeCompare(a.validFrom),
      ),
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
      await deleteTravelExpense(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('travelExpenseDeletedSuccess'));
      await loadConfigurations();
    } catch (err) {
      setDeleteError(parseTravelExpenseDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  if (formMode !== 'closed') {
    return (
      <TravelExpenseConfigurationForm
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
          <h1 className="page-title">{t('travExpConfiguration')}</h1>
          <p className="page-subtitle">{t('travExpConfigurationSubtitle')}</p>
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
        <p className="page-note">{t('travelExpenseSameDayMultiJobNote')}</p>

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
            <label className="filter-select">
              <span>{t('stenotypist')}</span>
              <select
                value={stenotypistUserId}
                onChange={(event) => {
                  setStenotypistUserId(event.target.value);
                  setPage(1);
                  setSuccess('');
                }}
              >
                <option value="">{t('allStenotypists')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {formatTravelExpenseStenotypistLabel(stenotypist.fullName, stenotypist.username)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('district')}</span>
              <select
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setPage(1);
                  setSuccess('');
                }}
              >
                <option value="">{t('allDistricts')}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {formatDistrictLabel(district)}
                  </option>
                ))}
              </select>
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
                  <th>{t('district')}</th>
                  <th>{t('amount')}</th>
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
                        {formatTravelExpenseStenotypistLabel(
                          row.stenotypistFullName,
                          row.stenotypistUsername,
                        )}
                      </td>
                      <td>
                        {formatTravelExpenseDistrictLabel(row.districtName, row.districtAlias)}
                      </td>
                      <td>{formatTravelExpenseAmount(row.amount)}</td>
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
        <DeleteTravelExpenseDialog
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
