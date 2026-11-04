import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import { deleteStenoRate, fetchStenoRateRecords } from '../../api/stenoRates';
import { downloadStenoRatesImportTemplate } from '../../config/stenoRatesImport';
import type { StenoRateImportResult, StenoRateRecord } from '../../types/stenoRates';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatDateDisplay } from '../../utils/dateFormat';
import ImportStenoRatesDialog from './ImportStenoRatesDialog';
import StenoRateDetailsForm from './StenoRateDetailsForm';
import '../../styles/financials.css';
import '../../styles/profile.css';
import '../../styles/projects.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';

function formatAmount(value: number): string {
  return Number(value ?? 0).toFixed(2);
}

function parseDeleteError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('stenoRateDeleteError');
}

export default function StenoRatesTable() {
  const { t } = useLanguage();
  const [rates, setRates] = useState<StenoRateRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerId, setCustomerId] = useState('');
  // Empty by default so freshly imported historical rates are all visible.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StenoRateRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchStenoRateRecords({
        customerId,
        dateFrom,
        dateTo,
        search,
      });
      setRates(rows);
    } catch {
      setError(t('stenoRatesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFrom, dateTo, search, t]);

  useEffect(() => {
    let active = true;
    fetchCustomers()
      .then((rows) => {
        if (active) setCustomers(rows);
      })
      .catch(() => {
        if (active) setError(t('stenoRatesLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const totalEntries = rates.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = useMemo(
    () => rates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rates, currentPage],
  );

  const resetPage = () => setPage(1);

  const handleSaved = (message: string) => {
    setFormMode('closed');
    setSelectedRateId(null);
    setSuccess(message);
    void loadRates();
  };

  const handleImported = (summary: StenoRateImportResult) => {
    setShowImport(false);
    let message = t('stenoRateImportSuccess')
      .replace('{created}', String(summary.created))
      .replace('{updated}', String(summary.updated))
      .replace('{skipped}', String(summary.skipped));
    if (summary.customersCreated) {
      message = `${message} ${t('stenoRateImportCustomersCreated').replace(
        '{count}',
        String(summary.customersCreated),
      )}`;
    }

    if (summary.skipped > 0 && summary.errors.length > 0) {
      const reasonCounts = new Map<string, number>();
      for (const entry of summary.errors) {
        reasonCounts.set(entry.message, (reasonCounts.get(entry.message) ?? 0) + 1);
      }
      const reasonText = [...reasonCounts.entries()]
        .map(([key, count]) => `${t(key as TranslationKey)} (${count})`)
        .join('; ');
      const samples = summary.errors
        .slice(0, 5)
        .map((entry) => {
          const label = t(entry.message as TranslationKey);
          return entry.detail
            ? `${t('importRowLabel')} ${entry.row}: ${label} — ${entry.detail}`
            : `${t('importRowLabel')} ${entry.row}: ${label}`;
        })
        .join(' | ');
      message = `${message} ${t('stenoRateImportSkipReasons').replace('{reasons}', reasonText)} ${samples}`;
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
    void loadRates();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteStenoRate(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('stenoRateDeletedSuccess'));
      await loadRates();
    } catch (err) {
      setDeleteError(parseDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  if (formMode !== 'closed') {
    return (
      <StenoRateDetailsForm
        mode={formMode}
        rateId={selectedRateId ?? undefined}
        onCancel={() => {
          setFormMode('closed');
          setSelectedRateId(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="financials-page">
      <div className="page-header financials-header customers-header">
        <div>
          <h1 className="page-title">{t('stenoRates')}</h1>
          <p className="page-subtitle">{t('stenoRatesSubtitle')}</p>
        </div>
        <div className="customers-header-actions">
          <button
            type="button"
            className="profile-cancel-btn"
            onClick={downloadStenoRatesImportTemplate}
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
              setSelectedRateId(null);
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
            <label className="date-field">
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
            <label className="date-field">
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
            <div className="filters-actions">
              <input
                type="search"
                className="search-input"
                placeholder={t('search')}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
              />
              <button
                type="button"
                className="refresh-btn"
                aria-label={t('refresh')}
                onClick={() => void loadRates()}
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
                    {t('customer')}
                    <SortIcon />
                  </th>
                  <th>{t('hourlyRate')}</th>
                  <th>{t('hourlyRateExpedited')}</th>
                  <th>{t('hourlyRateOutsideWorkingHrs')}</th>
                  <th>{t('hourlyRateOutsideWorkingHrsExpedited')}</th>
                  <th>{t('firstDiscountPercentage')}</th>
                  <th>{t('nrExemptedStenotypists')}</th>
                  <th>{t('secondDiscountPercentage')}</th>
                  <th>{t('secondStenotypistDiscountThreshold')}</th>
                  <th>{t('travelByKmAmount')}</th>
                  <th>{t('sla')}</th>
                  <th>{t('slaExpedited')}</th>
                  <th>{t('workingHoursStart')}</th>
                  <th>{t('workingHoursEnd')}</th>
                  <th>{t('validityFrom')}</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="empty-row">
                      {t('noRecordsFound')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.customerName || row.customerAlias}</td>
                      <td>{formatAmount(row.hourlyRate)}</td>
                      <td>{formatAmount(row.hourlyRateExpedited)}</td>
                      <td>{formatAmount(row.hourlyRateOutsideWorkingHrs)}</td>
                      <td>{formatAmount(row.hourlyRateOutsideWorkingHrsExpedited)}</td>
                      <td>{formatAmount(row.firstDiscountPercentage)}</td>
                      <td>{row.nrExemptedStenotypists}</td>
                      <td>{formatAmount(row.secondDiscountPercentage)}</td>
                      <td>{row.secondStenotypistDiscountThreshold}</td>
                      <td>{formatAmount(row.travelByKmAmount)}</td>
                      <td>{row.sla}</td>
                      <td>{row.slaExpedited}</td>
                      <td>{row.workingHoursStart}</td>
                      <td>{row.workingHoursEnd}</td>
                      <td>{formatDateDisplay(row.validityFrom)}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setFormMode('edit');
                              setSelectedRateId(row.id);
                              setSuccess('');
                            }}
                          >
                            {t('edit')}
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(row)}>
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
              onClick={() => setPage(1)}
            >
              {t('first')}
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage <= 1 || totalEntries === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              {t('previous')}
            </button>
            <span className="pagination-page">{currentPage}</span>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages || totalEntries === 0}
              onClick={() => setPage((value) => value + 1)}
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
      </div>

      {showImport ? (
        <ImportStenoRatesDialog onClose={() => setShowImport(false)} onImported={handleImported} />
      ) : null}

      {deleteTarget ? (
        <div className="dialog-overlay" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-steno-rate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-steno-rate-title">{t('deleteStenoRateTitle')}</h2>
            <p>
              {t('deleteStenoRateMessage')
                .replace('{customer}', deleteTarget.customerName || deleteTarget.customerAlias)
                .replace('{validityFrom}', formatDateDisplay(deleteTarget.validityFrom))}
            </p>
            {deleteError ? (
              <div className="profile-alert profile-alert-error">{deleteError}</div>
            ) : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
              >
                {deleting ? t('saving') : t('delete')}
              </button>
            </div>
          </div>
        </div>
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

function SortIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="sort-icon">
      <path d="M7 14l5-5 5 5z" />
    </svg>
  );
}
