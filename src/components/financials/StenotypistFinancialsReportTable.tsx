import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStenotypistFinancialsReportCandidates,
  fetchStenotypistFinancialsReportRecords,
} from '../../api/stenotypistFinancialsReport';
import {
  formatFinancialsReportCurrency,
  formatFinancialsReportStenotypistLabel,
  getPreviousMonthDateRange,
  STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE,
} from '../../config/stenotypistFinancialsReport';
import { isStenotypistFinancialsReportSelfServiceOnly } from '../../config/permissions';
import type {
  StenotypistFinancialsReportCandidate,
  StenotypistFinancialsReportRow,
  StenotypistFinancialsReportTotals,
} from '../../types/stenotypistFinancialsReport';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser } from '../../utils/auth';
import '../../styles/financials.css';

type DateRangePreset = 'previousMonth' | 'custom';

const EMPTY_TOTALS: StenotypistFinancialsReportTotals = {
  bonus: 0,
  penalty: 0,
  travelExpenses: 0,
  total: 0,
};

export default function StenotypistFinancialsReportTable() {
  const { t } = useLanguage();
  const previousMonthBounds = getPreviousMonthDateRange();
  const authUser = getAuthUser();
  const selfServiceOnly = isStenotypistFinancialsReportSelfServiceOnly(
    authUser?.roles ?? authUser?.role,
  );

  const [rows, setRows] = useState<StenotypistFinancialsReportRow[]>([]);
  const [totals, setTotals] = useState<StenotypistFinancialsReportTotals>(EMPTY_TOTALS);
  const [stenotypists, setStenotypists] = useState<StenotypistFinancialsReportCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('previousMonth');
  const [dateFrom, setDateFrom] = useState(previousMonthBounds.from);
  const [dateTo, setDateTo] = useState(previousMonthBounds.to);
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [page, setPage] = useState(1);

  const activeDateFrom =
    rangePreset === 'previousMonth' ? getPreviousMonthDateRange().from : dateFrom;
  const activeDateTo = rangePreset === 'previousMonth' ? getPreviousMonthDateRange().to : dateTo;

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchStenotypistFinancialsReportRecords({
        stenotypistUserId,
        dateFrom: activeDateFrom,
        dateTo: activeDateTo,
      });
      setRows(result.rows);
      setTotals(result.totals);
    } catch {
      setError(t('stenotypistFinancialsReportLoadError'));
      setRows([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchStenotypistFinancialsReportCandidates()
      .then((candidates) => {
        if (!active) return;
        setStenotypists(candidates);
        if (selfServiceOnly && candidates.length === 1) {
          setStenotypistUserId(candidates[0].id);
        }
      })
      .catch(() => {
        if (active) setError(t('stenotypistFinancialsReportLoadError'));
      });
    return () => {
      active = false;
    };
  }, [selfServiceOnly, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.earliestJobDate !== b.earliestJobDate) {
          return (a.earliestJobDate || '').localeCompare(b.earliestJobDate || '');
        }
        return a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
          sensitivity: 'base',
        });
      }),
    [rows],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart =
    totalEntries === 0 ? 0 : (currentPage - 1) * STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE + 1;
  const pageEnd =
    totalEntries === 0
      ? 0
      : Math.min(currentPage * STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE,
    currentPage * STENOTYPIST_FINANCIALS_REPORT_PAGE_SIZE,
  );

  function handleRangePresetChange(preset: DateRangePreset) {
    setRangePreset(preset);
    setPage(1);
    if (preset === 'previousMonth') {
      const bounds = getPreviousMonthDateRange();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
  }

  return (
    <div className="financials-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('stenotypistFinancialsReport')}</h1>
          <p className="page-subtitle">{t('stenotypistFinancialsReportSubtitle')}</p>
        </div>
      </header>

      <section className="financials-filters card">
        <div className="filter-grid">
          <label className="filter-field">
            <span>{t('dateRange')}</span>
            <select
              value={rangePreset}
              onChange={(event) => handleRangePresetChange(event.target.value as DateRangePreset)}
            >
              <option value="previousMonth">{t('previousMonth')}</option>
              <option value="custom">{t('customRange')}</option>
            </select>
          </label>

          {rangePreset === 'custom' ? (
            <>
              <label className="filter-field">
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
              <label className="filter-field">
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
            </>
          ) : null}

          <label className="filter-field">
            <span>{t('stenotypist')}</span>
            <select
              value={stenotypistUserId}
              disabled={selfServiceOnly}
              onChange={(event) => {
                setStenotypistUserId(event.target.value);
                setPage(1);
              }}
            >
              {!selfServiceOnly ? <option value="">{t('allStenotypists')}</option> : null}
              {stenotypists.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatFinancialsReportStenotypistLabel(candidate)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="card financials-table-card">
        {loading ? (
          <p className="loading-text">{t('loading')}</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('stenotypist')}</th>
                    <th>{t('bonus')}</th>
                    <th>{t('penalty')}</th>
                    <th>{t('travelExpenses')}</th>
                    <th>{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-table-cell">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.stenotypistFullName || row.stenotypistUsername || '—'}</td>
                        <td>{formatFinancialsReportCurrency(row.bonus)}</td>
                        <td>{formatFinancialsReportCurrency(row.penalty)}</td>
                        <td>{formatFinancialsReportCurrency(row.travelExpenses)}</td>
                        <td>{formatFinancialsReportCurrency(row.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="financials-totals-row">
                    <td>{t('totals')}</td>
                    <td>{formatFinancialsReportCurrency(totals.bonus)}</td>
                    <td>{formatFinancialsReportCurrency(totals.penalty)}</td>
                    <td>{formatFinancialsReportCurrency(totals.travelExpenses)}</td>
                    <td>{formatFinancialsReportCurrency(totals.total)}</td>
                  </tr>
                </tfoot>
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
      </section>
    </div>
  );
}
