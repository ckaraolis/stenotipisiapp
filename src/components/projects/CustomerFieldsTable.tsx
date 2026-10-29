import { useMemo, useState } from 'react';
import { mockCustomerFields } from '../../data/mockProjects';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';

export default function CustomerFieldsTable() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-06-17');
  const [dateTo, setDateTo] = useState('2026-06-17');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mockCustomerFields;
    return mockCustomerFields.filter(
      (row) =>
        row.customer.toLowerCase().includes(query) ||
        row.fieldName.toLowerCase().includes(query) ||
        row.fieldValue.toLowerCase().includes(query) ||
        row.users.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('customerFieldsToUsers')}</h1>
          <p className="page-subtitle">{t('customerFieldsSubtitle')}</p>
        </div>
        <button type="button" className="btn-primary">{t('addNew')}</button>
      </div>

      <div className="projects-panel">
        <div className="filters">
          <div className="filters-row">
            <FilterSelect label={t('allCustomers')} />
            <FilterSelect label={t('allField2Values')} />
            <FilterSelect label={t('allUsers')} />
          </div>
          <div className="filters-row">
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
          <table className="projects-table">
            <thead>
              <tr>
                <th className="sorted-col">
                  {t('customer')}
                  <SortIcon />
                </th>
                <th>{t('fieldName')}</th>
                <th>{t('fieldValue')}</th>
                <th>{t('users')}</th>
                <th>{t('validityFrom')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {t('noRecordsFound')}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.customer}-${row.fieldName}-${index}`}>
                    <td>{row.customer}</td>
                    <td>{row.fieldName}</td>
                    <td>{row.fieldValue}</td>
                    <td>{row.users}</td>
                    <td>{row.validityFrom}</td>
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
