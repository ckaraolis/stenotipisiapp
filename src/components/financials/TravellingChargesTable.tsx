import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import { fetchDistrictOptions } from '../../api/districts';
import {
  deleteTravellingCharge,
  fetchTravellingChargeRecords,
} from '../../api/travellingCharges';
import {
  formatTravellingChargeAmount,
  formatTravellingChargeCustomerLabel,
  formatTravellingChargeDistrictLabel,
} from '../../config/travellingCharges';
import { formatDistrictLabel } from '../../config/travellingTime';
import type { DistrictOption } from '../../types/district';
import type { TravellingChargeRecord } from '../../types/travellingCharges';
import { useLanguage } from '../../i18n/LanguageContext';
import DeleteTravellingChargeDialog, {
  parseTravellingChargeDeleteError,
} from './DeleteTravellingChargeDialog';
import TravellingChargeDetailsForm from './TravellingChargeDetailsForm';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function customerSortKey(row: TravellingChargeRecord): string {
  return formatTravellingChargeCustomerLabel(row);
}

export default function TravellingChargesTable() {
  const { t } = useLanguage();
  const today = getTodayDate();

  const [charges, setCharges] = useState<TravellingChargeRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [applicableDateFrom, setApplicableDateFrom] = useState(today);
  const [applicableDateTo, setApplicableDateTo] = useState(today);
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
      const rows = await fetchTravellingChargeRecords({
        customerId,
        districtId,
        dateFrom: applicableDateFrom,
        dateTo: applicableDateTo,
      });
      setCharges(rows);
    } catch {
      setError(t('travellingChargesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [applicableDateFrom, applicableDateTo, customerId, districtId, t]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchDistrictOptions()])
      .then(([customerRows, districtRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setDistricts(districtRows);
      })
      .catch(() => {
        if (active) setError(t('travellingChargesLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadCharges();
  }, [loadCharges]);

  const sortedRows = useMemo(() => {
    return [...charges].sort((a, b) => {
      const comparison = customerSortKey(a).localeCompare(customerSortKey(b), undefined, {
        sensitivity: 'base',
      });
      if (comparison !== 0) return comparison;
      return (
        formatTravellingChargeDistrictLabel(a).localeCompare(
          formatTravellingChargeDistrictLabel(b),
          undefined,
          { sensitivity: 'base' },
        ) || b.validityFrom.localeCompare(a.validityFrom)
      );
    });
  }, [charges]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const handleSaved = (message: string) => {
    setFormMode('closed');
    setSelectedChargeId(null);
    setSuccess(message);
    void loadCharges();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTravellingCharge(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('travellingChargeDeletedSuccess'));
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
        onCancel={() => {
          setFormMode('closed');
          setSelectedChargeId(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('travellingCharges')}</h1>
          <p className="page-subtitle">{t('travellingChargesSubtitle')}</p>
        </div>
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
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

        <div className="filters">
          <div className="filters-row">
            <label className="filter-select">
              <span>{t('applicableDateFrom')}</span>
              <input
                type="date"
                value={applicableDateFrom}
                onChange={(event) => {
                  setApplicableDateFrom(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label className="filter-select">
              <span>{t('applicableDateTo')}</span>
              <input
                type="date"
                value={applicableDateTo}
                onChange={(event) => {
                  setApplicableDateTo(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label className="filter-select">
              <span>{t('customer')}</span>
              <select
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allCustomers')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('district')}</span>
              <select
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allDistricts')}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {formatDistrictLabel(district)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="profile-message">{t('loading')}</div>
          ) : (
            <table className="financials-table">
              <thead>
                <tr>
                  <th className="sorted-col">
                    {t('customer')}
                    <SortIcon />
                  </th>
                  <th>{t('district')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('validFrom')}</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      {t('noRecordsFound')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatTravellingChargeCustomerLabel(row)}</td>
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

function SortIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="sort-icon">
      <path d="M7 14l5-5 5 5z" />
    </svg>
  );
}
