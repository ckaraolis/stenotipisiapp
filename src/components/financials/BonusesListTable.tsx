import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchBonusesStenotypistCandidates,
  fetchMonthlyBonusRecords,
} from '../../api/stenotypistBonuses';
import {
  BONUSES_LIST_PAGE_SIZE,
  formatBonusCurrency,
  formatBonusHours,
  formatBonusMonthLabel,
  formatBonusStenotypistLabel,
  formatMonthlyBonusStenotypistLabel,
  getThisYearDateRange,
} from '../../config/stenotypistBonuses';
import { isStenotypistBonusesSelfServiceOnly } from '../../config/permissions';
import type { MonthlyBonusRecord, StenotypistBonusesCandidate } from '../../types/stenotypistBonuses';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser } from '../../utils/auth';
import '../../styles/financials.css';

type DateRangePreset = 'thisYear' | 'custom';

export default function BonusesListTable() {
  const { t, language } = useLanguage();
  const thisYearBounds = getThisYearDateRange();
  const authUser = getAuthUser();
  const selfServiceOnly = isStenotypistBonusesSelfServiceOnly(authUser?.roles ?? authUser?.role);

  const [bonuses, setBonuses] = useState<MonthlyBonusRecord[]>([]);
  const [stenotypists, setStenotypists] = useState<StenotypistBonusesCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('thisYear');
  const [dateFrom, setDateFrom] = useState(thisYearBounds.from);
  const [dateTo, setDateTo] = useState(thisYearBounds.to);
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [page, setPage] = useState(1);

  const activeDateFrom = rangePreset === 'thisYear' ? getThisYearDateRange().from : dateFrom;
  const activeDateTo = rangePreset === 'thisYear' ? getThisYearDateRange().to : dateTo;

  const loadBonuses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMonthlyBonusRecords({
        stenotypistUserId,
        dateFrom: activeDateFrom,
        dateTo: activeDateTo,
      });
      setBonuses(rows);
    } catch {
      setError(t('bonusesListLoadError'));
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo, stenotypistUserId, t]);

  useEffect(() => {
    let active = true;
    fetchBonusesStenotypistCandidates()
      .then((rows) => {
        if (!active) return;
        setStenotypists(rows);
        if (selfServiceOnly && rows.length === 1) {
          setStenotypistUserId(rows[0].id);
        }
      })
      .catch(() => {
        if (active) setError(t('bonusesListLoadError'));
      });
    return () => {
      active = false;
    };
  }, [selfServiceOnly, t]);

  useEffect(() => {
    void loadBonuses();
  }, [loadBonuses]);

  const sortedRows = useMemo(
    () =>
      [...bonuses].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
          sensitivity: 'base',
        });
      }),
    [bonuses],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / BONUSES_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * BONUSES_LIST_PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * BONUSES_LIST_PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * BONUSES_LIST_PAGE_SIZE,
    currentPage * BONUSES_LIST_PAGE_SIZE,
  );

  function handleRangePresetChange(preset: DateRangePreset) {
    setRangePreset(preset);
    setPage(1);
    if (preset === 'thisYear') {
      const bounds = getThisYearDateRange();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
  }

  return (
    <div className="financials-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('bonusesList')}</h1>
          <p className="page-subtitle">{t('bonusesListSubtitle')}</p>
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
              <option value="thisYear">{t('thisYear')}</option>
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
                  {formatBonusStenotypistLabel(candidate)}
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
                    <th>{t('year')}</th>
                    <th>{t('month')}</th>
                    <th>{t('stenotypist')}</th>
                    <th>{t('totalHours')}</th>
                    <th>{t('baseHours')}</th>
                    <th>{t('extraHours')}</th>
                    <th>{t('bonusPerExtraHourEur')}</th>
                    <th>{t('moreTbd')}</th>
                    <th>{t('bonus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-table-cell">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.year}</td>
                        <td>{formatBonusMonthLabel(row.year, row.month, language)}</td>
                        <td>{formatMonthlyBonusStenotypistLabel(row)}</td>
                        <td>{formatBonusHours(row.totalHours)}</td>
                        <td>{formatBonusHours(row.baseHours)}</td>
                        <td>{formatBonusHours(row.extraHours)}</td>
                        <td>{formatBonusCurrency(row.bonusPerExtraHour)}</td>
                        <td>—</td>
                        <td>{formatBonusCurrency(row.bonus)}</td>
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
