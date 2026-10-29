import { useMemo, useState } from 'react';
import type { SimpleFinancialRow } from '../../data/mockFinancials';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/financials.css';

interface SimpleFinancialsTableProps {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  rows: SimpleFinancialRow[];
}

export default function SimpleFinancialsTable({
  titleKey,
  subtitleKey,
  rows,
}: SimpleFinancialsTableProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-06-17');
  const [dateTo, setDateTo] = useState('2026-06-17');

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.customer.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query),
    );
  }, [rows, search]);

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t(titleKey)}</h1>
          <p className="page-subtitle">{t(subtitleKey)}</p>
        </div>
        <button type="button" className="btn-primary">{t('addNew')}</button>
      </div>

      <div className="financials-panel">
        <div className="filters">
          <div className="filters-row">
            <FilterSelect label={t('allCustomers')} />
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
                onChange={(e) => setSearch(e.target.value)}
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
                  {t('customer')}
                  <SortIcon />
                </th>
                <th>{t('description')}</th>
                <th>{t('amount')}</th>
                <th>{t('validityFrom')}</th>
                <th>{t('status')}</th>
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {t('noRecordsFound')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={`${row.customer}-${index}`}>
                    <td>{row.customer}</td>
                    <td>{row.description}</td>
                    <td>{row.amount}</td>
                    <td>{row.validityFrom}</td>
                    <td>{row.status}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button">{t('edit')}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
