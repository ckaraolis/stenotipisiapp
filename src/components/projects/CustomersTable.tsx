import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteCustomer, fetchCustomerRecords } from '../../api/customers';
import { travellingChargesLabelKey, truncateRemarks } from '../../config/customer';
import { canAccessTravellingChargesModule } from '../../config/permissions';
import type { CustomerRecord } from '../../types/customer';
import CustomerDetailsForm from './CustomerDetailsForm';
import CustomerFieldsConfigurationPanel from './CustomerFieldsConfigurationPanel';
import CustomerTravellingChargesPanel from './CustomerTravellingChargesPanel';
import DeleteCustomerDialog, { parseCustomerDeleteError } from './DeleteCustomerDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser } from '../../utils/auth';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type ViewMode = 'list' | 'fields-config' | 'travelling-charges';
type SortDirection = 'asc' | 'desc';

export default function CustomersTable() {
  const { t } = useLanguage();
  const user = getAuthUser();
  const canManageTravellingCharges = canAccessTravellingChargesModule(user?.roles ?? user?.role);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

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

  const sortedRows = useMemo(() => {
    return [...customers].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [customers, sortDirection]);

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

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedCustomerId(null);
    setSuccess(message);
    await loadCustomers();
  };

  const handleOpenFieldsConfig = (customer: CustomerRecord) => {
    setViewMode('fields-config');
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setSuccess('');
    setError('');
  };

  const handleOpenTravellingCharges = (customer: CustomerRecord) => {
    if (!canManageTravellingCharges) return;
    setViewMode('travelling-charges');
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setSuccess('');
    setError('');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedCustomerId(null);
    setSelectedCustomerName('');
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

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  return (
    <div className="projects-page">
      {showList && (
        <div className="page-header projects-header">
          <div>
            <h1 className="page-title">{t('customers')}</h1>
            <p className="page-subtitle">{t('customersSubtitle')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
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

      {viewMode === 'travelling-charges' && selectedCustomerId && canManageTravellingCharges && (
        <CustomerTravellingChargesPanel
          customerId={selectedCustomerId}
          customerName={selectedCustomerName}
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

      {showList && (
        <div className="projects-panel">
          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="projects-table">
                  <thead>
                    <tr>
                      <th>{t('customerNumber')}</th>
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
                      <th>{t('hourlyRate')}</th>
                      <th>{t('serviceLevelAgreement')}</th>
                      <th>{t('travellingCharges')}</th>
                      <th>{t('remarks')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.customerNumber}</td>
                          <td>{row.name}</td>
                          <td>{row.alias}</td>
                          <td>{row.contactPerson || '—'}</td>
                          <td>{row.contactPhone || '—'}</td>
                          <td>{row.contactEmail || '—'}</td>
                          <td>{row.hourlyRate.toFixed(2)}</td>
                          <td>{row.sla}</td>
                          <td>{t(travellingChargesLabelKey(row.travellingCharges))}</td>
                          <td>{truncateRemarks(row.remarks)}</td>
                          <td className="actions-col">
                            <div className="row-actions">
                              <button type="button" onClick={() => handleOpenEdit(row)}>
                                {t('edit')}
                              </button>
                              <button type="button" onClick={() => handleDeleteRequest(row)}>
                                {t('delete')}
                              </button>
                              <button type="button" onClick={() => handleOpenFieldsConfig(row)}>
                                {t('fieldsConfiguration')}
                              </button>
                              {canManageTravellingCharges ? (
                                <button type="button" onClick={() => handleOpenTravellingCharges(row)}>
                                  {t('travellingCharges')}
                                </button>
                              ) : null}
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
