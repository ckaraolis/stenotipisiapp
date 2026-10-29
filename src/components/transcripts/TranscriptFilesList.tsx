import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadTranscriptFile,
  fetchTranscriptFilesList,
} from '../../api/transcriptFiles';
import {
  getTranscriptFileDescription,
  getTranscriptFileDescriptionFilterOptions,
} from '../../config/transcriptFiles';
import type { TranscriptFileListItem } from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import TranscriptOtherFileForm from './TranscriptOtherFileForm';
import TranscriptStandardFileForm from './TranscriptStandardFileForm';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create-other' | 'edit';

interface TranscriptFilesListProps {
  transcriptId: string;
  onClose: () => void;
}

function parseDownloadError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('transcriptFileDownloadError');
}

function canEditFileRow(
  file: TranscriptFileListItem,
  canManageStandard: boolean,
  canManageOther: boolean,
): boolean {
  if (file.isStandard) {
    return canManageStandard;
  }
  return canManageOther;
}

export default function TranscriptFilesList({ transcriptId, onClose }: TranscriptFilesListProps) {
  const { t } = useLanguage();
  const [jobNumber, setJobNumber] = useState('');
  const [files, setFiles] = useState<TranscriptFileListItem[]>([]);
  const [canManageStandard, setCanManageStandard] = useState(false);
  const [canManageOther, setCanManageOther] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editTarget, setEditTarget] = useState<TranscriptFileListItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTranscriptFilesList(transcriptId);
      setJobNumber(data.transcript.jobNumber);
      setFiles(data.files);
      setCanManageStandard(data.canManageStandard);
      setCanManageOther(data.canManageOther);
    } catch {
      setError(t('transcriptFilesLoadError'));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [transcriptId, t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const descriptionOptions = useMemo(
    () => getTranscriptFileDescriptionFilterOptions(files, t),
    [files, t],
  );

  const filteredRows = useMemo(() => {
    if (!descriptionFilter) return files;
    return files.filter(
      (row) => getTranscriptFileDescription(row, t) === descriptionFilter,
    );
  }, [files, descriptionFilter, t]);

  const totalEntries = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOpenCreate = () => {
    setFormMode('create-other');
    setEditTarget(null);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (file: TranscriptFileListItem) => {
    setFormMode('edit');
    setEditTarget(file);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setEditTarget(null);
  };

  const handleSaved = (message: string) => {
    setSuccess(message);
    handleCloseForm();
    void loadFiles();
  };

  const handleDownload = async (file: TranscriptFileListItem) => {
    setError('');
    setDownloadingId(file.rowId);
    try {
      await downloadTranscriptFile(transcriptId, file.slot, file.fileId, file.name);
    } catch (err) {
      setError(parseDownloadError((err as Error).message, t));
    } finally {
      setDownloadingId(null);
    }
  };

  if (formMode === 'create-other') {
    return (
      <TranscriptOtherFileForm
        mode="create"
        transcriptId={transcriptId}
        onCancel={handleCloseForm}
        onSaved={handleSaved}
      />
    );
  }

  if (formMode === 'edit' && editTarget) {
    if (editTarget.isStandard) {
      return (
        <TranscriptStandardFileForm
          transcriptId={transcriptId}
          file={editTarget}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      );
    }
    return (
      <TranscriptOtherFileForm
        mode="edit"
        transcriptId={transcriptId}
        file={editTarget}
        onCancel={handleCloseForm}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="transcripts-panel">
      <div className="projects-header">
        <div>
          <h2>{t('transcriptFilesListTitle').replace('{jobNumber}', jobNumber || '—')}</h2>
        </div>
        <div className="projects-header-actions">
          {canManageOther ? (
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              {t('addNew')}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filters-title">{t('filterTranscriptFiles')}</div>
        <div className="filters-row">
          <label className="filter-select">
            <span>{t('fileDescription')}</span>
            <select
              value={descriptionFilter}
              onChange={(event) => {
                setDescriptionFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allDescriptions')}</option>
              {descriptionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
      {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

      <div className="table-wrapper">
        <table className="projects-table transcripts-table">
          <thead>
            <tr>
              <th>{t('fileDescription')}</th>
              <th>{t('fileName')}</th>
              <th className="actions-col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="empty-row">
                  {t('loading')}
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-row">
                  {t('transcriptFilesEmpty')}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const canEdit = canEditFileRow(row, canManageStandard, canManageOther);
                return (
                  <tr key={row.rowId}>
                    <td>{getTranscriptFileDescription(row, t)}</td>
                    <td>{row.name}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        {canEdit ? (
                          <button type="button" onClick={() => handleOpenEdit(row)}>
                            {t('edit')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!row.hasStorage || downloadingId === row.rowId}
                          onClick={() => void handleDownload(row)}
                        >
                          {downloadingId === row.rowId ? t('downloading') : t('download')}
                        </button>
                      </div>
                    </td>
                  </tr>
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
    </div>
  );
}
