import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/projects.css';

interface SimpleProjectsTableProps {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  columns: { key: TranslationKey; field: string }[];
  rows: Record<string, string>[];
}

export default function SimpleProjectsTable({
  titleKey,
  subtitleKey,
  columns,
  rows,
}: SimpleProjectsTableProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const filteredRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return Object.values(row).some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t(titleKey)}</h1>
          <p className="page-subtitle">{t(subtitleKey)}</p>
        </div>
        <button type="button" className="btn-primary">{t('addNew')}</button>
      </div>

      <div className="projects-panel">
        <div className="filters">
          <div className="filters-row">
            <div className="filters-actions projects-search-only">
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
                {columns.map((column) => (
                  <th key={column.field}>{t(column.key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="empty-row">
                    {t('noRecordsFound')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.field}>{row[column.field]}</td>
                    ))}
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

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}
