import { useMemo, useState } from 'react';
import { mockAudioRemuneration } from '../../data/mockFinancials';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import '../../styles/financials.css';

const PAGE_SIZE = 10;

export default function AudioRemunerationTable() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-06-01');
  const [dateTo, setDateTo] = useState('2026-06-17');
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mockAudioRemuneration;
    return mockAudioRemuneration.filter((row) =>
      row.audioTranscriber.toLowerCase().includes(query),
    );
  }, [search]);

  const totalEntries = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('audioRemuneration')}</h1>
          <p className="page-subtitle">{t('audioRemunerationSubtitle')}</p>
        </div>
        <button type="button" className="btn-primary">{t('addNew')}</button>
      </div>

      <div className="financials-panel">
        <div className="filters">
          <div className="filters-row">
            <FilterSelect label={t('allAudioTranscribers')} />
            <label className="date-field">
              <span>{t('dateFrom')}</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="date-field">
              <span>{t('dateTo')}</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <div className="filters-actions">
              <input
                type="search"
                className="search-input"
                placeholder={t('search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <button type="button" className="refresh-btn" aria-label="Refresh">
                <RefreshIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="financials-table">
            <thead>
              <tr>
                <th className="sorted-col">
                  {t('audioTranscriber')}
                  <SortIcon />
                </th>
                <th>{t('percentage')}</th>
                <th>{t('targetHoursBeforeDeadline')}</th>
                <th>{t('penaltyPerHourLate')}</th>
                <th>{t('validFrom')}</th>
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {t('noRecordsFound')}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={`${row.audioTranscriber}-${row.validFrom}`}>
                    <td>{row.audioTranscriber}</td>
                    <td>{row.percentage}</td>
                    <td>{row.targetHoursBeforeDeadline}</td>
                    <td>{row.penaltyPerHourLate}</td>
                    <td>{formatDateDisplay(row.validFrom)}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button">{t('edit')}</button>
                        <button type="button">{t('delete')}</button>
                      </div>
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
              onClick={() => setPage(1)}
            >
              {t('first')}
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage <= 1 || totalEntries === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('previous')}
            </button>
            <span className="pagination-page">{currentPage}</span>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages || totalEntries === 0}
              onClick={() => setPage((p) => p + 1)}
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
    </div>
  );
}

function FilterSelect({ label }: { label: string }) {
  return (
    <label className="filter-select">
      <select defaultValue="">
        <option value="">{label}</option>
      </select>
    </label>
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
