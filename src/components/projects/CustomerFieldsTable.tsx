import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteCustomerFieldUserMapping,
  fetchCustomerFieldUserMappings,
} from '../../api/customerFieldsToUsers';
import type {
  CustomerFieldUserImportResult,
  CustomerFieldUserMapping,
} from '../../types/customerFieldUser';
import CustomerFieldUserDetailsForm from './CustomerFieldUserDetailsForm';
import DeleteCustomerFieldUserDialog, {
  parseCustomerFieldUserDeleteError,
} from './DeleteCustomerFieldUserDialog';
import ImportCustomerFieldsToUsersDialog from './ImportCustomerFieldsToUsersDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { formatDateDisplay } from '../../utils/dateFormat';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';
import DateInput from '../common/DateInput';



const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

export default function CustomerFieldsTable() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<CustomerFieldUserMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerFieldUserMapping | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('');
  const [fieldValueFilter, setFieldValueFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCustomerFieldUserMappings();
      setRows(data);
    } catch {
      setError(t('customerFieldsToUsersLoadError'));
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

  const fieldValueOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      if (row.fieldValue.trim()) values.add(row.fieldValue);
    });
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [rows]);

  const userOptions = useMemo(() => {
    const options = new Map<string, string>();
    rows.forEach((row) => {
      row.userIds.forEach((id, index) => {
        options.set(id, row.userAliases[index] || id);
      });
    });
    return [...options.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (customerFilter && row.customerId !== customerFilter) return false;
      if (fieldValueFilter && row.fieldValue !== fieldValueFilter) return false;
      if (userFilter && !row.userIds.includes(userFilter)) return false;
      if (dateFrom && row.validityFrom < dateFrom) return false;
      if (dateTo && row.validityFrom > dateTo) return false;
      if (!query) return true;
      return (
        row.customerName.toLowerCase().includes(query) ||
        row.fieldName.toLowerCase().includes(query) ||
        row.fieldValue.toLowerCase().includes(query) ||
        row.usersLabel.toLowerCase().includes(query)
      );
    });
  }, [rows, customerFilter, fieldValueFilter, userFilter, dateFrom, dateTo, searchQuery]);

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
    setImportWarnings([]);
  };

  const handleOpenEdit = (mappingId: string) => {
    setFormMode('edit');
    setSelectedId(mappingId);
    setSuccess('');
    setError('');
    setImportWarnings([]);
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

  const handleDeleteRequest = (row: CustomerFieldUserMapping) => {
    setDeleteError('');
    setDeleteTarget(row);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteCustomerFieldUserMapping(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('customerFieldUserDeletedSuccess'));
      await loadRows();
    } catch (err) {
      setDeleteError(parseCustomerFieldUserDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const handleImported = async (summary: CustomerFieldUserImportResult) => {
    setShowImport(false);
    setSuccess(
      t('customerFieldUserImportSuccess')
        .replace('{created}', String(summary.created))
        .replace('{updated}', String(summary.updated))
        .replace('{skipped}', String(summary.skipped)),
    );
    setImportWarnings(
      (summary.errors ?? []).slice(0, 20).map((item) =>
        t('customerFieldUserImportErrorLine')
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
            <h1 className="page-title">{t('customerFieldsToUsers')}</h1>
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
        <CustomerFieldUserDetailsForm
          mode={formMode}
          mappingId={selectedId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteCustomerFieldUserDialog
          label={`${deleteTarget.customerName} — ${deleteTarget.fieldValue}`}
          error={deleteError}
          deleting={deleting}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError('');
          }}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      )}

      {showImport && (
        <ImportCustomerFieldsToUsersDialog
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
                  value={fieldValueFilter}
                  onChange={(event) => {
                    setFieldValueFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t('allField2Values')}</option>
                  {fieldValueOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={userFilter}
                  onChange={(event) => {
                    setUserFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t('allUsers')}</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="filters-row customers-filters-row">
              <label className="date-field">
                <span>{t('dateFrom')}</span>
                <DateInput
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="date-field">
                <span>{t('dateTo')}</span>
                <DateInput
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                />
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
              <div>{t('customerFieldUserImportErrorsHeading')}</div>
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
                      <th>{t('fieldName')}</th>
                      <th>{t('fieldValue')}</th>
                      <th>{t('users')}</th>
                      <th>{t('validityFrom')}</th>
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
                          <td>{row.fieldName || ''}</td>
                          <td>{row.fieldValue}</td>
                          <td>{row.usersLabel || '—'}</td>
                          <td>{formatDateDisplay(row.validityFrom)}</td>
                          <td className="actions-col">
                            <div className="project-type-actions">
                              <button type="button" onClick={() => handleOpenEdit(row.id)}>
                                {t('edit')}
                              </button>
                              <button type="button" onClick={() => handleDeleteRequest(row)}>
                                {t('delete')}
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
