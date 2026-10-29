import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchJobPenaltyRecords,
  fetchPenaltiesStenotypistCandidates,
} from '../../api/stenotypistPenalties';
import {
  formatDateTimeDisplay,
  formatJobDateDdMmYy,
  formatJobPenaltyStenotypistLabel,
  formatPenaltyDelayHours,
  formatPenaltyListCurrency,
  formatPenaltyStenotypistLabel,
  getPreviousMonthDateRange,
  PENALTIES_LIST_PAGE_SIZE,
} from '../../config/stenotypistPenalties';
import { isStenotypistPenaltiesSelfServiceOnly } from '../../config/permissions';
import type { JobPenaltyRecord, StenotypistPenaltiesCandidate } from '../../types/stenotypistPenalties';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser } from '../../utils/auth';
import '../../styles/financials.css';

type DateRangePreset = 'previousMonth' | 'custom';

export default function PenaltiesListTable() {
  const { t } = useLanguage();
  const previousMonthBounds = getPreviousMonthDateRange();
  const authUser = getAuthUser();
  const selfServiceOnly = isStenotypistPenaltiesSelfServiceOnly(authUser?.roles ?? authUser?.role);

  const [penalties, setPenalties] = useState<JobPenaltyRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<StenotypistPenaltiesCandidate[]>([]);
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

  const loadPenalties = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchJobPenaltyRecords({
        stenotypistUserId,
        dateFrom: activeDateFrom,
        dateTo: activeDateTo,
      });
      setPenalties(rows);
    } catch {
      setError(t('penaltiesListLoadError'));
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchPenaltiesStenotypistCandidates()
      .then((rows) => {
        if (!active) return;
        setStenotypists(rows);
        if (selfServiceOnly && rows.length === 1) {
          setStenotypistUserId(rows[0].id);
        }
      })
      .catch(() => {
        if (active) setError(t('penaltiesListLoadError'));
      });
    return () => {
      active = false;
    };
  }, [selfServiceOnly, t]);

  useEffect(() => {
    void loadPenalties();
  }, [loadPenalties]);

  const sortedRows = useMemo(
    () =>
      [...penalties].sort((a, b) => {
        if (a.jobDate !== b.jobDate) return a.jobDate.localeCompare(b.jobDate);
        return a.jobNumber.localeCompare(b.jobNumber);
      }),
    [penalties],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PENALTIES_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PENALTIES_LIST_PAGE_SIZE + 1;
  const pageEnd =
    totalEntries === 0 ? 0 : Math.min(currentPage * PENALTIES_LIST_PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * PENALTIES_LIST_PAGE_SIZE,
    currentPage * PENALTIES_LIST_PAGE_SIZE,
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
          <h1 className="page-title">{t('penaltiesList')}</h1>
          <p className="page-subtitle">{t('penaltiesListSubtitle')}</p>
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
                  {formatPenaltyStenotypistLabel(candidate)}
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
                    <th>{t('customerAlias')}</th>
                    <th>{t('project')}</th>
                    <th>{t('jobNumber')}</th>
                    <th>{t('jobDate')}</th>
                    <th>{t('jobEndTimeAdministrator')}</th>
                    <th>{t('serviceLevel')}</th>
                    <th>{t('gracePeriod')}</th>
                    <th>{t('requiredSubmissionDateTime')}</th>
                    <th>{t('actualSubmissionDateTime')}</th>
                    <th>{t('delay')}</th>
                    <th>{t('basePenalty')}</th>
                    <th>{t('extraPenalty')}</th>
                    <th>{t('totalPenalty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="empty-table-cell">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatJobPenaltyStenotypistLabel(row)}</td>
                        <td>{row.customerAlias || '—'}</td>
                        <td>{row.projectLabel}</td>
                        <td>{row.jobNumber}</td>
                        <td>{formatJobDateDdMmYy(row.jobDate)}</td>
                        <td>{row.jobEndTimeAdministrator || '—'}</td>
                        <td>{row.serviceLevel}</td>
                        <td>{row.gracePeriodHours}</td>
                        <td>{formatDateTimeDisplay(row.requiredSubmissionDateTime)}</td>
                        <td>{formatDateTimeDisplay(row.actualSubmissionDateTime)}</td>
                        <td>{formatPenaltyDelayHours(row.delayHours)}</td>
                        <td>{formatPenaltyListCurrency(row.basePenalty)}</td>
                        <td>{formatPenaltyListCurrency(row.extraPenalty)}</td>
                        <td>{formatPenaltyListCurrency(row.totalPenalty)}</td>
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
      </section>
    </div>
  );
}
