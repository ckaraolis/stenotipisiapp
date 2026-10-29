import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchStenotypistAssignmentsPerDistrictReport } from '../../api/stenotypistAssignmentsPerDistrictReport';
import { formatDistrictLabel } from '../../config/travellingTime';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type {
  AssignmentsPerDistrictColumn,
  AssignmentsPerDistrictRow,
  StenotypistAssignmentsPerDistrictReportView,
} from '../../types/stenotypistAssignmentsPerDistrictReport';
import { getThisMonthDateRange } from '../../utils/reportDateRanges';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/financials.css';
import '../../styles/scheduling-reports.css';

const PAGE_SIZE = 50;

type SortDirection = 'asc' | 'desc';

function parseReportError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('assignmentsPerDistrictLoadError');
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <span className="sort-icon" aria-hidden="true">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
}

export default function StenotypistAssignmentsPerDistrictReportTable() {
  const { t } = useLanguage();
  const defaultRange = useMemo(() => getThisMonthDateRange(), []);

  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [districts, setDistricts] = useState<AssignmentsPerDistrictColumn[]>([]);
  const [rows, setRows] = useState<AssignmentsPerDistrictRow[]>([]);
  const [pagination, setPagination] = useState<StenotypistAssignmentsPerDistrictReportView['pagination']>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalRows: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDistricts([]);
      setRows([]);
      setPagination({ page: 1, pageSize: PAGE_SIZE, totalRows: 0, totalPages: 1 });
      setError(t('assignmentsPerDistrictDateRangeInvalid'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await fetchStenotypistAssignmentsPerDistrictReport({
        dateFrom,
        dateTo,
        page,
        pageSize: PAGE_SIZE,
        sortDirection,
      });
      setDistricts(data.districts);
      setRows(data.rows);
      setPagination(data.pagination);
      if (data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
    } catch (err) {
      setDistricts([]);
      setRows([]);
      setPagination({ page: 1, pageSize: PAGE_SIZE, totalRows: 0, totalPages: 1 });
      setError(parseReportError((err as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page, sortDirection, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const totalEntries = pagination.totalRows;
  const totalPages = pagination.totalPages;
  const currentPage = pagination.page;
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);

  const resetPage = () => setPage(1);

  const applyThisMonth = () => {
    const range = getThisMonthDateRange();
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    resetPage();
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    resetPage();
  };

  return (
    <section
      className="assignments-per-district-report"
      aria-label={t('assignmentsPerDistrictReport')}
    >
      <div className="filters">
        <div className="filters-row">
          <label className="filter-select">
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
          <label className="filter-select">
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
          <button type="button" className="btn-secondary report-preset-btn" onClick={applyThisMonth}>
            {t('reportThisMonth')}
          </button>
        </div>
      </div>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

      {loading ? (
        <div className="profile-message">{t('loading')}</div>
      ) : (
        <>
          <div className="table-wrapper assignments-matrix-wrapper">
            <table className="projects-table assignments-per-district-table">
              <thead>
                <tr>
                  <th className="sticky-col sorted-col">
                    <button type="button" className="sort-header-btn" onClick={toggleSort}>
                      {t('stenotypist')}
                      <SortIcon direction={sortDirection} />
                    </button>
                  </th>
                  {districts.map((district, index) => (
                    <th key={district.id} className="district-col" title={district.name}>
                      {formatDistrictLabel({
                        districtName: district.name,
                        districtAlias: district.alias,
                      }) || t('reportDistrictColumn').replace('{number}', String(index + 1))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, districts.length + 1)} className="empty-row">
                      {t('noRecordsFound')}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="sticky-col stenotypist-col">
                        <span className="staff-code">{row.alias}</span>
                        {row.fullName ? (
                          <span className="stenotypist-full-name">{row.fullName}</span>
                        ) : null}
                      </td>
                      {districts.map((district) => (
                        <td key={district.id} className="hours-col">
                          {row.hoursByDistrictId[district.id] ?? '0'}
                        </td>
                      ))}
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
                onClick={() => setPage(1)}
              >
                {t('first')}
              </button>
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage <= 1 || totalEntries === 0}
                onClick={() => setPage((current) => current - 1)}
              >
                {t('previous')}
              </button>
              <span className="pagination-page">{currentPage}</span>
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage >= totalPages || totalEntries === 0}
                onClick={() => setPage((current) => current + 1)}
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
        </>
      )}
    </section>
  );
}
