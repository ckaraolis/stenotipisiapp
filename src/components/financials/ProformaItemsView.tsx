import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProformaItems } from '../../api/proformas';
import {
  formatProformaDate,
  formatProformaTotalAmount,
  parseProformaError,
} from '../../config/proforma';
import {
  formatJobDurationHours,
  formatProformaProcessDate,
  formatProformaProcessLineTotal,
} from '../../config/proformaProcess';
import type { ProformaLineItem, ProformaRecord } from '../../types/proforma';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/financials.css';
import '../../styles/profile.css';

const PAGE_SIZE = 20;

interface ProformaItemsViewProps {
  proformaId: string;
  onClose: () => void;
}

export default function ProformaItemsView({ proformaId, onClose }: ProformaItemsViewProps) {
  const { t } = useLanguage();
  const [proforma, setProforma] = useState<ProformaRecord | null>(null);
  const [items, setItems] = useState<ProformaLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchProformaItems(proformaId);
      setProforma(result.proforma);
      setItems(result.items);
      setPage(1);
    } catch (err) {
      setError(parseProformaError((err as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [proformaId, t]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const dateCompare = a.jobDate.localeCompare(b.jobDate);
        if (dateCompare !== 0) return dateCompare;
        if (a.jobNumber !== b.jobNumber) return a.jobNumber.localeCompare(b.jobNumber);
        return a.type === 'stenotyping' ? -1 : 1;
      }),
    [items],
  );

  const totalEntries = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = useMemo(
    () => sortedItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, sortedItems],
  );

  const renderLineCell = (value: string) => value || '—';

  return (
    <div className="dialog-overlay proforma-items-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card proforma-items-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proforma-items-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="proforma-items-dialog-header">
          <h2 id="proforma-items-title">{t('proformaItemsTitle')}</h2>
          <button type="button" className="btn-link proforma-items-close" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        {proforma ? (
          <dl className="proforma-items-meta">
            <div className="proforma-items-meta-item">
              <dt>{t('proformaNumber')}</dt>
              <dd>{proforma.proformaNumber}</dd>
            </div>
            <div className="proforma-items-meta-item">
              <dt>{t('proformaDate')}</dt>
              <dd>{formatProformaDate(proforma.proformaDate)}</dd>
            </div>
            <div className="proforma-items-meta-item">
              <dt>{t('customer')}</dt>
              <dd>{proforma.customerLabel || proforma.customerName || '—'}</dd>
            </div>
            <div className="proforma-items-meta-item">
              <dt>{t('proformaTotalAmount')}</dt>
              <dd>{formatProformaTotalAmount(proforma.totalAmount)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="proforma-items-dialog-body">
          {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
          {loading ? (
            <p>{t('loading')}</p>
          ) : pageRows.length === 0 ? (
            <p>{t('noRecordsFound')}</p>
          ) : (
            <>
              <div className="table-wrap proforma-items-table-wrap">
                <table className="data-table proforma-items-table">
                  <thead>
                    <tr>
                      <th>{t('jobNumber')}</th>
                      <th>{t('jobDate')}</th>
                      <th>{t('project')}</th>
                      <th>{t('stenotypistAlias')}</th>
                      <th>{t('receiptNumber')}</th>
                      <th>{t('jobDuration')}</th>
                      <th>{t('hourlyRate')}</th>
                      <th>{t('district')}</th>
                      <th>{t('proformaProcessTravellingCharges')}</th>
                      <th>{t('proformaProcessLineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.jobNumber}</td>
                        <td>{formatProformaProcessDate(item.jobDate)}</td>
                        <td>{item.projectLabel}</td>
                        <td>{renderLineCell(item.stenotypistAlias)}</td>
                        <td>{renderLineCell(item.receiptNumber)}</td>
                        <td>
                          {item.type === 'stenotyping'
                            ? renderLineCell(formatJobDurationHours(item.jobDurationHours))
                            : '—'}
                        </td>
                        <td>
                          {item.type === 'stenotyping' && item.hourlyRate !== null
                            ? item.hourlyRate.toFixed(2)
                            : '—'}
                        </td>
                        <td>{item.districtLabel}</td>
                        <td>
                          {item.type === 'travelling' && item.travellingCharges !== null
                            ? formatProformaProcessLineTotal(item.travellingCharges)
                            : '—'}
                        </td>
                        <td>{formatProformaProcessLineTotal(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-pagination financials-pagination proforma-items-pagination">
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
      </div>
    </div>
  );
}
