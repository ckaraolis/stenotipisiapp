import { useCallback, useEffect, useState } from 'react';
import {
  deleteTravellingCharge,
  fetchTravellingChargeRecords,
} from '../../api/travellingCharges';
import {
  formatTravellingChargeAmount,
  formatTravellingChargeDistrictLabel,
} from '../../config/travellingCharges';
import type { TravellingChargeRecord } from '../../types/travellingCharges';
import { useLanguage } from '../../i18n/LanguageContext';
import DeleteTravellingChargeDialog, {
  parseTravellingChargeDeleteError,
} from '../financials/DeleteTravellingChargeDialog';
import TravellingChargeDetailsForm from '../financials/TravellingChargeDetailsForm';
import '../../styles/financials.css';
import '../../styles/projects.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';

interface CustomerTravellingChargesPanelProps {
  customerId: string;
  customerName: string;
  onBack: () => void;
  onSaved?: (message: string) => void;
}

export default function CustomerTravellingChargesPanel({
  customerId,
  customerName,
  onBack,
  onSaved,
}: CustomerTravellingChargesPanelProps) {
  const { t } = useLanguage();
  const [charges, setCharges] = useState<TravellingChargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravellingChargeRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadCharges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchTravellingChargeRecords({ customerId });
      setCharges(rows);
    } catch {
      setError(t('travellingChargesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [customerId, t]);

  useEffect(() => {
    void loadCharges();
  }, [loadCharges]);

  const totalEntries = charges.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = charges.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSaved = (message: string) => {
    setFormMode('closed');
    setSelectedChargeId(null);
    setSuccess(message);
    onSaved?.(message);
    void loadCharges();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTravellingCharge(deleteTarget.id);
      setDeleteTarget(null);
      const message = t('travellingChargeDeletedSuccess');
      setSuccess(message);
      onSaved?.(message);
      await loadCharges();
    } catch (err) {
      setDeleteError(parseTravellingChargeDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  if (formMode !== 'closed') {
    return (
      <TravellingChargeDetailsForm
        mode={formMode}
        chargeId={selectedChargeId ?? undefined}
        defaultCustomerId={customerId}
        lockCustomer
        onCancel={() => {
          setFormMode('closed');
          setSelectedChargeId(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="customer-config-panel">
      <div className="page-header projects-header customer-config-header">
        <div>
          <h2 className="page-title">{t('customerTravellingChargesTitle')}</h2>
          <p className="page-subtitle">{customerName}</p>
        </div>
        <div className="customer-config-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormMode('create');
              setSelectedChargeId(null);
              setSuccess('');
            }}
          >
            {t('addNew')}
          </button>
          <button type="button" className="profile-cancel-btn" onClick={onBack}>
            {t('backToCustomers')}
          </button>
        </div>
      </div>

      <div className="financials-panel projects-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

        <div className="table-wrapper">
          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <table className="financials-table projects-table">
              <thead>
                <tr>
                  <th>{t('district')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('validFrom')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      {t('noRecordsFound')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatTravellingChargeDistrictLabel(row)}</td>
                      <td>{formatTravellingChargeAmount(row.amount)}</td>
                      <td>{row.validityFrom}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setFormMode('edit');
                              setSelectedChargeId(row.id);
                              setSuccess('');
                            }}
                          >
                            {t('edit')}
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(row)}>
                            {t('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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

      {deleteTarget ? (
        <DeleteTravellingChargeDialog
          charge={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError('');
          }}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </div>
  );
}
