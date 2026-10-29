import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteStenotypistAsset,
  fetchStenotypistAssets,
  type StenotypistAsset,
} from '../../api/stenotypistAssets';
import StenotypistAssetForm from './StenotypistAssetForm';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

export default function StenotypistAssetsTable() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<StenotypistAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [actionAssetId, setActionAssetId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStenotypistAssets();
      setAssets(data);
    } catch {
      setError(t('stenotypistAssetLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const sortedRows = useMemo(() => {
    return [...assets].sort((a, b) => {
      const comparison = a.stenotypistName.localeCompare(b.stenotypistName, undefined, {
        sensitivity: 'base',
      });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [assets, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const handleDelete = async (asset: StenotypistAsset) => {
    if (!window.confirm(t('stenotypistAssetDeleteConfirm'))) return;

    setActionAssetId(asset.id);
    setError('');
    setSuccess('');
    try {
      await deleteStenotypistAsset(asset.id);
      setSuccess(t('stenotypistAssetDeletedSuccess'));
      await loadAssets();
    } catch {
      setError(t('stenotypistAssetDeleteError'));
    } finally {
      setActionAssetId(null);
    }
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedAssetId(null);
    setSuccess(message);
    await loadAssets();
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedAssetId(null);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedAssetId(null);
  };

  const handleOpenEdit = (assetId: string) => {
    setFormMode('edit');
    setSelectedAssetId(assetId);
    setSuccess('');
    setError('');
  };

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('stenotypistAssets')}</h1>
          <p className="page-subtitle">{t('stenotypistAssetsSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <StenotypistAssetForm
          mode={formMode}
          assetId={selectedAssetId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

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
                        {t('stenotypist')}
                        <SortIcon direction={sortDirection} />
                      </button>
                    </th>
                    <th>{t('laptopSerialNumber')}</th>
                    <th>{t('stenotypeMachineSerialNumber')}</th>
                    <th>{t('catalystProductKey')}</th>
                    <th className="actions-col">{t('actions')}</th>
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
                        <td>{row.stenotypistName}</td>
                        <td>{row.laptopSerialNumber || '—'}</td>
                        <td>{row.stenotypeMachineSerialNumber || '—'}</td>
                        <td>{row.catalystProductKey || '—'}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => handleOpenEdit(row.id)}>
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              disabled={actionAssetId === row.id}
                              onClick={() => void handleDelete(row)}
                            >
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
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t('previous')}
                </button>
                <span className="pagination-page">{currentPage}</span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPage >= totalPages || totalEntries === 0}
                  onClick={() => setPage((value) => value + 1)}
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
