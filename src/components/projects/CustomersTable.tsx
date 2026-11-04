import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteCustomer,
  fetchCustomerRecords,
  updateCustomerStatus,
} from '../../api/customers';
import { truncateRemarks } from '../../config/customer';
import type { CustomerImportResult, CustomerRecord } from '../../types/customer';
import CustomerDetailsForm from './CustomerDetailsForm';
import CustomerFieldsConfigurationPanel from './CustomerFieldsConfigurationPanel';
import DeleteCustomerDialog, { parseCustomerDeleteError } from './DeleteCustomerDialog';
import ImportCustomersDialog from './ImportCustomersDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type ViewMode = 'list' | 'fields-config';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'enabled' | 'disabled';
type ServiceTypeFilter = 'all' | 'steno' | 'audio' | 'captions';

export default function CustomersTable() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('enabled');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCustomerRecords();
      setCustomers(data);
    } catch {
      setError(t('customersLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter === 'enabled' && !customer.enabled) return false;
      if (statusFilter === 'disabled' && customer.enabled) return false;
      if (serviceTypeFilter === 'steno' && !customer.isStenoCustomer) return false;
      if (serviceTypeFilter === 'audio' && !customer.isAudioCustomer) return false;
      if (serviceTypeFilter === 'captions' && !customer.isCaptionsCustomer) return false;
      if (!query) return true;
      const haystack = [
        customer.name,
        customer.alias,
        customer.contactPerson,
        customer.contactPhone,
        customer.contactEmail,
        customer.paymentTerms,
        customer.priorityErpNumber,
        customer.remarks,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [customers, searchQuery, serviceTypeFilter, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const showList = formMode === 'closed' && viewMode === 'list';

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedCustomerId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (customer: CustomerRecord) => {
    setFormMode('edit');
    setSelectedCustomerId(customer.id);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedCustomerId(null);
  };

  const handleSaved = async (message: string, next: 'close' | 'add-another' = 'close') => {
    setSuccess(message);
    await loadCustomers();
    if (next === 'add-another') {
      setFormMode('create');
      setSelectedCustomerId(null);
      return;
    }
    setFormMode('closed');
    setSelectedCustomerId(null);
  };

  const handleOpenFieldsConfig = (customer: CustomerRecord) => {
    setViewMode('fields-config');
    setSelectedCustomerId(customer.id);
    setSuccess('');
    setError('');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedCustomerId(null);
  };

  const handleDeleteRequest = (customer: CustomerRecord) => {
    setDeleteError('');
    setDeleteTarget(customer);
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
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('customerDeletedSuccess'));
      await loadCustomers();
    } catch (err) {
      setDeleteError(parseCustomerDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (customer: CustomerRecord) => {
    setStatusUpdatingId(customer.id);
    setError('');
    try {
      await updateCustomerStatus(customer.id, !customer.enabled);
      setSuccess(
        customer.enabled ? t('customerDisabledSuccess') : t('customerEnabledSuccess'),
      );
      await loadCustomers();
    } catch {
      setError(t('customerStatusUpdateError'));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleImported = async (summary: CustomerImportResult) => {
    setShowImport(false);
    setSuccess(
      t('customerImportSuccess')
        .replace('{created}', String(summary.created))
        .replace('{updated}', String(summary.updated))
        .replace('{skipped}', String(summary.skipped)),
    );
    await loadCustomers();
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
            <h1 className="page-title">{t('customers')}</h1>
            <p className="page-subtitle">{t('customersSubtitle')}</p>
          </div>
          <div className="customers-header-actions">
            <button type="button" className="profile-cancel-btn" onClick={() => setShowImport(true)}>
              {t('importFromExcel')}
            </button>
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              {t('addNew')}
            </button>
          </div>
        </div>
      )}

      {formMode !== 'closed' && (
        <CustomerDetailsForm
          mode={formMode}
          customerId={selectedCustomerId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {viewMode === 'fields-config' && selectedCustomerId && (
        <CustomerFieldsConfigurationPanel
          customerId={selectedCustomerId}
          onBack={handleBackToList}
          onSaved={(message) => setSuccess(message)}
        />
      )}

      {deleteTarget && (
        <DeleteCustomerDialog
          customerName={deleteTarget.name}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {showImport && (
        <ImportCustomersDialog
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
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">{t('allStatuses')}</option>
                  <option value="enabled">{t('enabled')}</option>
                  <option value="disabled">{t('disabled')}</option>
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => {
                    setServiceTypeFilter(e.target.value as ServiceTypeFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">{t('allTypes')}</option>
                  <option value="steno">{t('stenoCustomer')}</option>
                  <option value="audio">{t('audioCustomer')}</option>
                  <option value="captions">{t('captionsCustomer')}</option>
                </select>
              </label>

              <div className="customers-search">
                <input
                  type="search"
                  className="profile-input"
                  value={searchQuery}
                  placeholder={t('search')}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className="btn-primary customers-refresh-btn"
                  onClick={() => void loadCustomers()}
                  title={t('refresh')}
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="projects-table customers-table">
                  <thead>
                    <tr>
                      <th className="sorted-col">
                        <button type="button" className="sort-header-btn" onClick={toggleSort}>
                          {t('name')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('alias')}</th>
                      <th>{t('contactPerson')}</th>
                      <th>{t('contactPhone')}</th>
                      <th>{t('contactEmail')}</th>
                      <th>{t('paymentTerms')}</th>
                      <th>{t('priorityErpNumber')}</th>
                      <th>{t('status')}</th>
                      <th>{t('remarks')}</th>
                      <th className="center">{t('stenoCustomer')}</th>
                      <th className="center">{t('audioCustomer')}</th>
                      <th className="center">{t('captionsCustomer')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.alias}</td>
                          <td>{row.contactPerson || '—'}</td>
                          <td>{row.contactPhone || '—'}</td>
                          <td>{row.contactEmail || '—'}</td>
                          <td>{row.paymentTerms || '—'}</td>
                          <td>{row.priorityErpNumber || '—'}</td>
                          <td>
                            <span
                              className={`profile-status-badge ${
                                row.enabled ? 'profile-status-active' : 'profile-status-inactive'
                              }`}
                            >
                              {row.enabled ? t('enabled') : t('disabled')}
                            </span>
                          </td>
                          <td>{truncateRemarks(row.remarks)}</td>
                          <td className="center">{row.isStenoCustomer ? '✓' : ''}</td>
                          <td className="center">{row.isAudioCustomer ? '✓' : ''}</td>
                          <td className="center">{row.isCaptionsCustomer ? '✓' : ''}</td>
                          <td className="actions-col">
                            <div className="row-actions">
                              <button type="button" onClick={() => handleOpenEdit(row)}>
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
                              <button type="button" onClick={() => handleOpenFieldsConfig(row)}>
                                {t('fields')}
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
      <path d="M7 14l5-5 5 5z" />
    </svg>
  );
}
