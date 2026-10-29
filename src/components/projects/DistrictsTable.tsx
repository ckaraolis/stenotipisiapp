import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteDistrict, fetchDistrictRecords } from '../../api/districts';
import type { DistrictRecord } from '../../types/district';
import DeleteDistrictDialog, { parseDistrictDeleteError } from './DeleteDistrictDialog';
import DistrictDetailsForm from './DistrictDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

export default function DistrictsTable() {
  const { t } = useLanguage();
  const [districts, setDistricts] = useState<DistrictRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DistrictRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const loadDistricts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDistrictRecords();
      setDistricts(data);
    } catch {
      setError(t('districtsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDistricts();
  }, [loadDistricts]);

  const sortedRows = useMemo(() => {
    return [...districts].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [districts, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedDistrictId(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (districtId: string) => {
    setFormMode('edit');
    setSelectedDistrictId(districtId);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedDistrictId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedDistrictId(null);
    setSuccess(message);
    await loadDistricts();
  };

  const handleDeleteRequest = (district: DistrictRecord) => {
    setDeleteError('');
    setDeleteTarget(district);
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
      await deleteDistrict(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('districtDeletedSuccess'));
      await loadDistricts();
    } catch (err) {
      setDeleteError(parseDistrictDeleteError((err as Error).message, t));
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
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('projectDistrict')}</h1>
          <p className="page-subtitle">{t('districtsSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <DistrictDetailsForm
          mode={formMode}
          districtId={selectedDistrictId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteDistrictDialog
          districtName={deleteTarget.name}
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
                          {t('districtName')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('districtAlias')}</th>
                      <th className="actions-col">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty-row">
                          {t('noRecordsFound')}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.alias}</td>
                          <td className="actions-col">
                            <div className="row-actions">
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
