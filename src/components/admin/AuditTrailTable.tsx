import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAuditTrailEntryById,
  fetchAuditTrailFilterOptions,
  fetchAuditTrailRecords,
} from '../../api/auditTrail';
import {
  AUDIT_ENTITY_NAME_OPTIONS,
  AUDIT_ENTRY_TYPE_OPTIONS,
  AUDIT_MODULE_OPTIONS,
  AUDIT_TRAIL_PAGE_SIZE,
  auditEntityNameLabelKey,
  auditEntryTypeLabelKey,
  auditModuleLabelKey,
  formatAuditTrailTimestamp,
  formatAuditTrailUserLabel,
  getTodayDateRange,
} from '../../config/auditTrail';
import type {
  AuditTrailEntry,
  AuditTrailUserOption,
} from '../../types/auditTrail';
import { useLanguage } from '../../i18n/LanguageContext';
import AuditTrailDetailsForm from './AuditTrailDetailsForm';
import '../../styles/financials.css';

type DateRangePreset = 'today' | 'custom';

export default function AuditTrailTable() {
  const { t } = useLanguage();
  const todayBounds = getTodayDateRange();

  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [users, setUsers] = useState<AuditTrailUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('today');
  const [dateFrom, setDateFrom] = useState(todayBounds.from);
  const [dateTo, setDateTo] = useState(todayBounds.to);
  const [userId, setUserId] = useState('');
  const [module, setModule] = useState('');
  const [entityName, setEntityName] = useState('');
  const [entityNumber, setEntityNumber] = useState('');
  const [entryType, setEntryType] = useState('');
  const [page, setPage] = useState(1);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<AuditTrailEntry | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const activeDateFrom = rangePreset === 'today' ? getTodayDateRange().from : dateFrom;
  const activeDateTo = rangePreset === 'today' ? getTodayDateRange().to : dateTo;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchAuditTrailRecords({
        dateFrom: activeDateFrom,
        dateTo: activeDateTo,
        userId,
        module,
        entityName,
        entityNumber,
        entryType,
      });
      setEntries(rows);
    } catch {
      setError(t('auditTrailLoadError'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeDateFrom,
    activeDateTo,
    userId,
    module,
    entityName,
    entityNumber,
    entryType,
    t,
  ]);

  useEffect(() => {
    let active = true;
    fetchAuditTrailFilterOptions()
      .then((options) => {
        if (active) setUsers(options.users ?? []);
      })
      .catch(() => {
        if (active) setError(t('auditTrailLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const sortedRows = useMemo(
    () =>
      [...entries].sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? '')),
    [entries],
  );

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / AUDIT_TRAIL_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * AUDIT_TRAIL_PAGE_SIZE + 1;
  const pageEnd =
    totalEntries === 0 ? 0 : Math.min(currentPage * AUDIT_TRAIL_PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * AUDIT_TRAIL_PAGE_SIZE,
    currentPage * AUDIT_TRAIL_PAGE_SIZE,
  );

  function handleRangePresetChange(preset: DateRangePreset) {
    setRangePreset(preset);
    setPage(1);
    if (preset === 'today') {
      const bounds = getTodayDateRange();
      setDateFrom(bounds.from);
      setDateTo(bounds.to);
    }
  }

  async function handleView(entry: AuditTrailEntry) {
    setViewLoading(true);
    setViewEntry(null);
    setViewOpen(true);
    setError('');
    try {
      const detailed = await fetchAuditTrailEntryById(entry.id);
      setViewEntry(detailed);
    } catch {
      setViewOpen(false);
      setViewEntry(null);
      setError(t('auditTrailEntryLoadError'));
    } finally {
      setViewLoading(false);
    }
  }

  function handleCloseDetails() {
    setViewOpen(false);
    setViewEntry(null);
    setViewLoading(false);
  }

  return (
    <div className="financials-page">
      {viewOpen ? (
        <AuditTrailDetailsForm
          entry={viewEntry}
          loading={viewLoading || !viewEntry}
          onClose={handleCloseDetails}
        />
      ) : null}

      <header className="page-header">
        <div>
          <h1 className="page-title">{t('auditTrail')}</h1>
          <p className="page-subtitle">{t('auditTrailSubtitle')}</p>
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
              <option value="today">{t('today')}</option>
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
            <span>{t('user')}</span>
            <select
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allUsers')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatAuditTrailUserLabel(user)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{t('module')}</span>
            <select
              value={module}
              onChange={(event) => {
                setModule(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allModules')}</option>
              {AUDIT_MODULE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(auditModuleLabelKey(option))}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{t('entityName')}</span>
            <select
              value={entityName}
              onChange={(event) => {
                setEntityName(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allEntityNames')}</option>
              {AUDIT_ENTITY_NAME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(auditEntityNameLabelKey(option))}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{t('entityNumber')}</span>
            <input
              type="text"
              value={entityNumber}
              onChange={(event) => {
                setEntityNumber(event.target.value);
                setPage(1);
              }}
              placeholder={t('entityNumberFilterPlaceholder')}
            />
          </label>

          <label className="filter-field">
            <span>{t('entryType')}</span>
            <select
              value={entryType}
              onChange={(event) => {
                setEntryType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allEntryTypes')}</option>
              {AUDIT_ENTRY_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(auditEntryTypeLabelKey(option))}
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
                    <th>{t('timestamp')}</th>
                    <th>{t('user')}</th>
                    <th>{t('module')}</th>
                    <th>{t('entityName')}</th>
                    <th>{t('entityNumber')}</th>
                    <th>{t('entryType')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-table-cell">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatAuditTrailTimestamp(row.timestamp)}</td>
                        <td>
                          {formatAuditTrailUserLabel({
                            fullName: row.userFullName,
                            username: row.userUsername,
                          })}
                        </td>
                        <td>{t(auditModuleLabelKey(row.module))}</td>
                        <td>{t(auditEntityNameLabelKey(row.entityName))}</td>
                        <td>{row.entityNumber || '—'}</td>
                        <td>{t(auditEntryTypeLabelKey(row.entryType))}</td>
                        <td className="table-actions">
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void handleView(row)}
                          >
                            {t('view')}
                          </button>
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
      </section>
    </div>
  );
}
