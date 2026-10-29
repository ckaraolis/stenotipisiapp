import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import { fetchProformaRecords, voidProforma } from '../../api/proformas';
import {
  formatProformaDate,
  formatProformaTotalAmount,
  getLast60DaysDateRange,
  parseProformaError,
  proformaStatusLabelKey,
} from '../../config/proforma';
import { PROFORMA_STATUSES } from '../../types/proforma';
import type { ProformaRecord } from '../../types/proforma';
import { useLanguage } from '../../i18n/LanguageContext';
import ProformaItemsView from './ProformaItemsView';
import VoidProformaDialog from './VoidProformaDialog';
import '../../styles/financials.css';

const PAGE_SIZE = 50;

const defaultDateRange = getLast60DaysDateRange();

interface ProformasTableProps {
  embedded?: boolean;
}

export default function ProformasTable({ embedded = false }: ProformasTableProps) {
  const { t } = useLanguage();

  const [proformas, setProformas] = useState<ProformaRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [viewProformaId, setViewProformaId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<ProformaRecord | null>(null);
  const [voidStep, setVoidStep] = useState<'confirm' | 'warning'>('confirm');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const loadProformas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchProformaRecords({
        customerId,
        dateFrom,
        dateTo,
        status,
      });
      setProformas(rows);
    } catch (err) {
      setError(parseProformaError((err as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFrom, dateTo, status, t]);

  useEffect(() => {
    let active = true;
    fetchCustomers()
      .then((rows) => {
        if (active) setCustomers(rows);
      })
      .catch(() => {
        if (active) setError(t('proformasLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadProformas();
  }, [loadProformas]);

  const totalEntries = proformas.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = useMemo(
    () => proformas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, proformas],
  );

  const closeVoidDialog = () => {
    setVoidTarget(null);
    setVoidStep('confirm');
    setVoidError('');
  };

  const handleVoidProceed = async () => {
    if (!voidTarget) return;

    if (voidStep === 'confirm') {
      setVoidStep('warning');
      return;
    }

    setVoiding(true);
    setVoidError('');
    setError('');
    setSuccess('');
    try {
      await voidProforma(voidTarget.id, { postCreditInvoice: false });
      setSuccess(t('proformaVoidSuccess'));
      closeVoidDialog();
      await loadProformas();
    } catch (err) {
      setVoidError(parseProformaError((err as Error).message, t));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className={embedded ? 'proforma-issued-table' : 'financials-page'}>
      {!embedded ? (
        <div className="page-header financials-header">
          <div>
            <h1 className="page-title">{t('proformasListTitle')}</h1>
            <p className="page-subtitle">{t('proformasListSubtitle')}</p>
          </div>
        </div>
      ) : null}

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
                  setPage(1);
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
                  setPage(1);
                }}
              />
            </label>
            <label className="filter-select">
              <span>{t('customer')}</span>
              <select
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('proformaProcessNoCustomerSelected')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('proformaStatus')}</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('allStatuses')}</option>
                {PROFORMA_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(proformaStatusLabelKey(value))}
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
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('proformaNumber')}</th>
                    <th>{t('proformaDate')}</th>
                    <th>{t('proformaStatus')}</th>
                    <th>{t('customer')}</th>
                    <th>{t('proformaTotalAmount')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>{t('noRecordsFound')}</td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.proformaNumber}</td>
                        <td>{formatProformaDate(row.proformaDate)}</td>
                        <td>{t(proformaStatusLabelKey(row.status))}</td>
                        <td>{row.customerLabel || row.customerName || '—'}</td>
                        <td>{formatProformaTotalAmount(row.totalAmount)}</td>
                        <td className="table-actions">
                          {row.status === 'exported' ? (
                            <>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => setViewProformaId(row.id)}
                              >
                                {t('view')}
                              </button>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                  setVoidTarget(row);
                                  setVoidStep('confirm');
                                  setVoidError('');
                                }}
                              >
                                {t('proformaVoid')}
                              </button>
                            </>
                          ) : null}
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

      {viewProformaId ? (
        <ProformaItemsView proformaId={viewProformaId} onClose={() => setViewProformaId(null)} />
      ) : null}

      {voidTarget ? (
        <VoidProformaDialog
          proforma={voidTarget}
          step={voidStep}
          voiding={voiding}
          error={voidError}
          onCancel={closeVoidDialog}
          onProceed={() => void handleVoidProceed()}
        />
      ) : null}
    </div>
  );
}
