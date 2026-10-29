import { useMemo, useState } from 'react';
import type { ProjectTranscriptOwner } from '../../types/project';
import DeleteTranscriptOwnerDialog, {
  parseTranscriptOwnerDeleteError,
} from './DeleteTranscriptOwnerDialog';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type SortDirection = 'asc' | 'desc';

interface ProjectTranscriptOwnersListProps {
  owners: ProjectTranscriptOwner[];
  canManage: boolean;
  onAdd: () => void;
  onDelete: (owner: ProjectTranscriptOwner) => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
}

export default function ProjectTranscriptOwnersList({
  owners,
  canManage,
  onAdd,
  onDelete,
  successMessage,
  errorMessage,
}: ProjectTranscriptOwnersListProps) {
  const { t } = useLanguage();
  const [sortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTranscriptOwner | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [localError, setLocalError] = useState('');

  const sortedRows = useMemo(() => {
    return [...owners].sort((a, b) => {
      const comparison = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [owners, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleDeleteRequest = (owner: ProjectTranscriptOwner) => {
    setLocalError('');
    if (owners.length <= 1) {
      setLocalError(t('projectTranscriptOwnerRequired'));
      return;
    }
    setDeleteError('');
    setDeleteTarget(owner);
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
      await onDelete(deleteTarget);
      setDeleteTarget(null);
      setPage(1);
    } catch (err) {
      setDeleteError(parseTranscriptOwnerDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const displayError = errorMessage || localError;

  return (
    <section className="project-transcript-owners">
      <div className="project-transcript-owners-header">
        <h3>{t('transcriptOwners')}</h3>
        {canManage && (
          <button type="button" className="btn-primary" onClick={onAdd}>
            {t('addNew')}
          </button>
        )}
      </div>

      {displayError && <div className="profile-alert profile-alert-error">{displayError}</div>}
      {successMessage && (
        <div className="profile-alert profile-alert-success">{successMessage}</div>
      )}

      <div className="table-wrapper">
        <table className="projects-table">
          <thead>
            <tr>
              <th className="sorted-col">
                {t('fullName')}
                <SortIcon direction={sortDirection} />
              </th>
              <th>{t('alias')}</th>
              <th>{t('emailAddress')}</th>
              {canManage && <th className="actions-col">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="empty-row">
                  {t('noTranscriptOwnersAssigned')}
                </td>
              </tr>
            ) : (
              pageRows.map((owner) => (
                <tr key={owner.id}>
                  <td>{owner.fullName}</td>
                  <td>{owner.username}</td>
                  <td>{owner.email}</td>
                  {canManage && (
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button" onClick={() => handleDeleteRequest(owner)}>
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  )}
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

      {deleteTarget && (
        <DeleteTranscriptOwnerDialog
          ownerName={deleteTarget.fullName}
          error={deleteError || undefined}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
    </section>
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
