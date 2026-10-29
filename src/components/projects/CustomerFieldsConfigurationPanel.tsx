import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteCustomerFieldValue,
  fetchCustomerById,
  fetchCustomerFieldValues,
} from '../../api/customers';
import type { CustomerFieldValue, CustomerRecord } from '../../types/customer';
import CustomerFieldConfigurationForm from './CustomerFieldConfigurationForm';
import DeleteCustomerFieldValueDialog, {
  parseCustomerFieldValueDeleteError,
} from './DeleteCustomerFieldValueDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/projects.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

interface CustomerFieldsConfigurationPanelProps {
  customerId: string;
  onBack: () => void;
  onSaved?: (message: string) => void;
}

type FormMode = 'closed' | 'create' | 'edit';

type FieldValueRow = CustomerFieldValue & {
  fieldLabel: string;
};

function getFieldLabel(customer: CustomerRecord, fieldReference: 1 | 2): string {
  return fieldReference === 1 ? customer.field1Name : customer.field2Name;
}

export default function CustomerFieldsConfigurationPanel({
  customerId,
  onBack,
  onSaved,
}: CustomerFieldsConfigurationPanelProps) {
  const { t } = useLanguage();
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [fieldValues, setFieldValues] = useState<CustomerFieldValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedFieldValue, setSelectedFieldValue] = useState<CustomerFieldValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FieldValueRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customerData, values] = await Promise.all([
        fetchCustomerById(customerId),
        fetchCustomerFieldValues(customerId),
      ]);
      setCustomer(customerData);
      setFieldValues(values);
    } catch {
      setError(t('customerLoadError'));
    } finally {
      setLoading(false);
    }
  }, [customerId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedRows = useMemo<FieldValueRow[]>(() => {
    if (!customer) return [];
    return fieldValues
      .map((row) => ({
        ...row,
        fieldLabel: getFieldLabel(customer, row.fieldReference),
      }))
      .sort((a, b) => {
        const fieldCompare = a.fieldReference - b.fieldReference;
        if (fieldCompare !== 0) return fieldCompare;
        return a.order - b.order;
      });
  }, [customer, fieldValues]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedFieldValue(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (row: CustomerFieldValue) => {
    setFormMode('edit');
    setSelectedFieldValue(row);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedFieldValue(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedFieldValue(null);
    setSuccess(message);
    onSaved?.(message);
    await loadData();
  };

  const handleDeleteRequest = (row: FieldValueRow) => {
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
      await deleteCustomerFieldValue(customerId, deleteTarget.id);
      setDeleteTarget(null);
      const message = t('customerFieldValueDeletedSuccess');
      setSuccess(message);
      onSaved?.(message);
      await loadData();
    } catch (err) {
      setDeleteError(parseCustomerFieldValueDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  if (!customer) {
    return (
      <div className="projects-panel">
        <div className="profile-alert profile-alert-error">{t('customerLoadError')}</div>
        <button type="button" className="profile-cancel-btn" onClick={onBack}>
          {t('backToCustomers')}
        </button>
      </div>
    );
  }

  return (
    <div className="customer-config-panel">
      <div className="page-header projects-header customer-config-header">
        <div>
          <h2 className="page-title">{t('customerFieldsConfigurationTitle')}</h2>
          <p className="page-subtitle">
            {customer.name} ({customer.customerNumber})
          </p>
        </div>
        <div className="customer-config-header-actions">
          {formMode === 'closed' && (
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              {t('addNew')}
            </button>
          )}
          <button type="button" className="profile-cancel-btn" onClick={onBack}>
            {t('backToCustomers')}
          </button>
        </div>
      </div>

      {formMode !== 'closed' && (
        <CustomerFieldConfigurationForm
          mode={formMode}
          customer={customer}
          fieldValueId={selectedFieldValue?.id}
          initialFieldReference={selectedFieldValue?.fieldReference}
          initialValue={selectedFieldValue?.value ?? ''}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteCustomerFieldValueDialog
          fieldValue={deleteTarget.value}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {formMode === 'closed' && (
        <div className="projects-panel">
          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          <div className="table-wrapper">
            <table className="projects-table customer-fields-table">
              <thead>
                <tr>
                  <th>{t('fieldName')}</th>
                  <th>{t('fieldValue')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-row">
                      {t('fieldOptionsEmpty')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, index) => {
                    const previousRow = index > 0 ? pageRows[index - 1] : null;
                    const showGroupHeader =
                      !previousRow || previousRow.fieldReference !== row.fieldReference;

                    return (
                      <GroupRows
                        key={row.id}
                        row={row}
                        showGroupHeader={showGroupHeader}
                        onEdit={handleOpenEdit}
                        onDelete={handleDeleteRequest}
                      />
                    );
                  })
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
      )}
    </div>
  );
}

function GroupRows({
  row,
  showGroupHeader,
  onEdit,
  onDelete,
}: {
  row: FieldValueRow;
  showGroupHeader: boolean;
  onEdit: (row: CustomerFieldValue) => void;
  onDelete: (row: FieldValueRow) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      {showGroupHeader && (
        <tr className="table-group-row">
          <td colSpan={2}>{row.fieldLabel || '—'}</td>
          <td />
        </tr>
      )}
      <tr>
        <td aria-hidden="true" className="customer-field-group-indent" />
        <td>{row.value}</td>
        <td className="actions-col">
          <div className="row-actions">
            <button type="button" onClick={() => onEdit(row)}>
              {t('edit')}
            </button>
            <button type="button" onClick={() => onDelete(row)}>
              {t('delete')}
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}
