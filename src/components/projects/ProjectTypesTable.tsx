import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteProjectType,
  fetchProjectTypeRecords,
  updateProjectTypeStatus,
} from '../../api/projectTypes';
import type { ProjectTypeImportResult, ProjectTypeRecord } from '../../types/projectType';
import DeleteProjectTypeDialog, { parseProjectTypeDeleteError } from './DeleteProjectTypeDialog';
import ImportProjectTypesDialog from './ImportProjectTypesDialog';
import ProjectTypeDetailsForm from './ProjectTypeDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'enabled' | 'disabled';

export default function ProjectTypesTable() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<ProjectTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTypeRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchProjectTypeRecords();
      setRows(data);
    } catch {
      setError(t('projectTypesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const customerOptions = useMemo(() => {
    const options = new Map<string, string>();
    rows.forEach((row) => {
      if (row.customerId) options.set(row.customerId, row.customerName);
    });
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (customerFilter && row.customerId !== customerFilter) return false;
      if (statusFilter === 'enabled' && !row.enabled) return false;
      if (statusFilter === 'disabled' && row.enabled) return false;
      if (!query) return true;
      return (
        row.customerName.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.alias.toLowerCase().includes(query) ||
        row.transcriptText.toLowerCase().includes(query)
      );
    });
  }, [rows, customerFilter, statusFilter, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: 'base',
      });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const showList = formMode === 'closed';

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (projectTypeId: string) => {
    setFormMode('edit');
    setSelectedId(projectTypeId);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedId(null);
    setSuccess(message);
    await loadRows();
  };

  const handleDeleteRequest = (row: ProjectTypeRecord) => {
    setDeleteError('');
    setDeleteTarget(row);
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteProjectType(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('projectTypeDeletedSuccess'));
      await loadRows();
    } catch (err) {
      setDeleteError(parseProjectTypeDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (row: ProjectTypeRecord) => {
    setStatusUpdatingId(row.id);
    setError('');
    try {
      await updateProjectTypeStatus(row.id, !row.enabled);
      setSuccess(row.enabled ? t('projectTypeDisabledSuccess') : t('projectTypeEnabledSuccess'));
      await loadRows();
    } catch {
      setError(t('projectTypeStatusUpdateError'));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleImported = async (summary: ProjectTypeImportResult) => {
    setShowImport(false);
    setSuccess(
      t('projectTypeImportSuccess')
        .replace('{created}', String(summary.created))
        .replace('{updated}', String(summary.updated))
        .replace('{skipped}', String(summary.skipped)),
    );
    setImportWarnings(
      (summary.errors ?? []).slice(0, 20).map((item) =>
        t('projectTypeImportErrorLine')
          .replace('{row}', String(item.row))
          .replace('{message}', t(item.message as TranslationKey))
          .replace('{detail}', item.detail ? ` (${item.detail})` : ''),
      ),
    );
    await loadRows();
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  return (
    <div className="projects-page">
      {showList && (
        <div className="page-header projects-header customers-header">
          <div>
            <h1 className="page-title">{t('projectTypes')}</h1>
            <button type="button" className="btn-primary projects-add-btn" onClick={handleOpenCreate}>
              {t('addNew')}
            </button>
          </div>
          <div className="customers-header-actions">
            <button type="button" className="profile-cancel-btn" onClick={() => setShowImport(true)}>
              {t('importFromExcel')}
            </button>
          </div>
        </div>
      )}

      {formMode !== 'closed' && (
        <ProjectTypeDetailsForm
          mode={formMode}
          projectTypeId={selectedId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteProjectTypeDialog
          label={`${deleteTarget.customerName} — ${deleteTarget.type}`}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      )}

      {showImport && (
        <ImportProjectTypesDialog
          onClose={() => setShowImport(false)}
          onImported={(summary) => {
            void handleImported(summary);
          }}
        />
      )}

      {showList && (
        <div className="projects-panel">
          <div className="filters">
            <div className="filters-row customers-filters-row">
              <label className="filter-select">
                <select
                  value={customerFilter}
                  onChange={(event) => {
                    setCustomerFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t('allCustomers')}</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">{t('allStatuses')}</option>
                  <option value="enabled">{t('enabled')}</option>
                  <option value="disabled">{t('disabled')}</option>
                </select>
              </label>

              <div className="customers-search">
                <input
                  type="search"
                  className="profile-input"
                  value={searchQuery}
                  placeholder={t('search')}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className="btn-primary customers-refresh-btn"
                  onClick={() => void loadRows()}
                  title={t('refresh')}
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}
          {importWarnings.length > 0 && (
            <div className="profile-alert profile-alert-error">
              <div>{t('projectTypeImportErrorsHeading')}</div>
              <ul className="project-type-import-warnings">
                {importWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="projects-table">
                  <thead>
                    <tr>
                      <th className="sorted-col">
                        <button type="button" className="sort-header-btn" onClick={toggleSort}>
                          {t('customer')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('type')}</th>
                      <th>{t('alias')}</th>
                      <th>{t('transcriptText')}</th>
                      <th>{t('status')}</th>
                      <th className="actions-col" aria-label={t('actions')} />
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
                        <tr key={row.id}>
                          <td>{row.customerName || '—'}</td>
                          <td>{row.type}</td>
                          <td>{row.alias}</td>
                          <td>{row.transcriptText || ''}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                row.enabled ? 'status-project-open' : 'status-project-closed'
                              }`}
                            >
                              {row.enabled ? t('enabled') : t('disabled')}
                            </span>
                          </td>
                          <td className="actions-col">
                            <div className="project-type-actions">
                              <button type="button" onClick={() => handleOpenEdit(row.id)}>
                                {t('edit')}
                              </button>
                              <button type="button" onClick={() => handleDeleteRequest(row)}>
                                {t('delete')}
                              </button>
                              <button
                                type="button"
                                disabled={statusUpdatingId === row.id}
                                onClick={() => void handleToggleStatus(row)}
                              >
                                {row.enabled ? t('disable') : t('enable')}
                              </button>
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
        </div>
      )}
    </div>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`sort-icon${direction === 'desc' ? ' sort-icon-desc' : ''}`}
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}
