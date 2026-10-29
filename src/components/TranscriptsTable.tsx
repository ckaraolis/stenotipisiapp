import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTranscriptList } from '../api/transcripts';
import { downloadTranscriptFile } from '../api/transcriptFiles';
import { jobStatusLabelKey } from '../config/job';
import {
  canUseTranscriptCustomerFilter,
  canUseTranscriptEditorFilter,
  canUseTranscriptOwnerFilter,
  canUseTranscriptReviewerFilter,
  canUseTranscriptStenotypistFilter,
  getTranscriptListDefaults,
} from '../config/transcriptList';
import {
  formatTranscriptEte,
  formatTranscriptListDeadline,
  formatTranscriptListEditDuration,
  formatTranscriptOwnerLabels,
  getTranscriptDownloadTarget,
  getTranscriptListInlineActions,
  type TranscriptListInlineAction,
  type TranscriptListSortDirection,
  type TranscriptListSortKey,
} from '../config/transcriptListDisplay';
import { formatTranscriptJobStatus } from '../config/transcriptDetails';
import type { TranscriptType } from '../types/transcript';
import type {
  TranscriptListFilterOptions,
  TranscriptListPagination,
  TranscriptRecord,
  TranscriptViewScope,
} from '../types/transcript';
import { getAuthUser } from '../utils/auth';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import TranscriptFilesList from './transcripts/TranscriptFilesList';
import TranscriptDetailsForm from './transcripts/TranscriptDetailsForm';
import PublishTranscriptDialog from './transcripts/PublishTranscriptDialog';
import SubmitEditedTranscriptWorkflow from './transcripts/SubmitEditedTranscriptWorkflow';
import SubmitReviewedTranscriptWorkflow from './transcripts/SubmitReviewedTranscriptWorkflow';
import TranscriptReportDialog from './transcripts/TranscriptReportDialog';

const PAGE_SIZE = 20;
const AUTO_REFRESH_MS = 60_000;

type OverlayMode =
  | 'closed'
  | 'edit'
  | 'files'
  | 'edited'
  | 'reviewed'
  | 'publish'
  | 'report';

interface TranscriptsTableProps {
  variant: TranscriptType;
  onViewScopeChange?: (scope: TranscriptViewScope) => void;
  onFormOpenChange?: (open: boolean) => void;
}

function parseActionError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('transcriptWorkflowSaveError');
}

export default function TranscriptsTable({
  variant,
  onViewScopeChange,
  onFormOpenChange,
}: TranscriptsTableProps) {
  const { t } = useLanguage();
  const authUser = getAuthUser();
  const defaults = useMemo(() => getTranscriptListDefaults(), []);

  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [jobStatus, setJobStatus] = useState(defaults.jobStatus);
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [editorUserId, setEditorUserId] = useState('');
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [transcriptOwnerUserId, setTranscriptOwnerUserId] = useState('');
  const [sortBy, setSortBy] = useState<TranscriptListSortKey>('date');
  const [sortDirection, setSortDirection] = useState<TranscriptListSortDirection>('desc');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TranscriptRecord[]>([]);
  const [filterOptions, setFilterOptions] = useState<TranscriptListFilterOptions>({
    customers: [],
    projects: [],
    stenotypists: [],
    editors: [],
    reviewers: [],
    transcriptOwners: [],
    statuses: [],
  });
  const [viewScope, setViewScope] = useState<TranscriptViewScope>('none');
  const [pagination, setPagination] = useState<TranscriptListPagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalRows: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('closed');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);
  const [dateRangeInitialized, setDateRangeInitialized] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadTranscripts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTranscriptList({
        type: variant,
        jobStatus,
        customerId,
        projectId,
        stenotypistUserId,
        editorUserId,
        reviewerUserId,
        transcriptOwnerUserId,
        dateFrom,
        dateTo,
        search,
        sortBy,
        sortDirection,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(data.transcripts);
      setFilterOptions(data.filterOptions);
      setViewScope(data.viewScope);
      onViewScopeChange?.(data.viewScope);
      setPagination(data.pagination);
      if (!dateRangeInitialized && data.suggestedDateRange) {
        setDateFrom(data.suggestedDateRange.dateFrom);
        setDateTo(data.suggestedDateRange.dateTo);
        setDateRangeInitialized(true);
      }
      if (data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
    } catch {
      setRows([]);
      setPagination({ page: 1, pageSize: PAGE_SIZE, totalRows: 0, totalPages: 1 });
      setError(t('transcriptsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [
    variant,
    jobStatus,
    customerId,
    projectId,
    stenotypistUserId,
    editorUserId,
    reviewerUserId,
    transcriptOwnerUserId,
    dateFrom,
    dateTo,
    search,
    sortBy,
    sortDirection,
    page,
    dateRangeInitialized,
    t,
    onViewScopeChange,
  ]);

  useEffect(() => {
    void loadTranscripts();
  }, [loadTranscripts]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadTranscripts();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadTranscripts]);

  const projectOptions = useMemo(() => {
    if (!customerId) return filterOptions.projects;
    return filterOptions.projects.filter((project) => project.customerId === customerId);
  }, [customerId, filterOptions.projects]);

  const totalEntries = pagination.totalRows;
  const totalPages = pagination.totalPages;
  const currentPage = pagination.page;
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);

  const resetPage = () => setPage(1);

  const showCustomerFilter = canUseTranscriptCustomerFilter(viewScope);
  const showStenotypistFilter = canUseTranscriptStenotypistFilter(viewScope);
  const showEditorFilter = canUseTranscriptEditorFilter(viewScope, authUser?.roles ?? authUser?.role);
  const showReviewerFilter = canUseTranscriptReviewerFilter(
    viewScope,
    authUser?.roles ?? authUser?.role,
  );
  const showOwnerFilter = canUseTranscriptOwnerFilter(viewScope, authUser?.roles ?? authUser?.role);

  const closeOverlay = () => {
    setOverlayMode('closed');
    setSelectedTranscript(null);
    onFormOpenChange?.(false);
  };

  const handleWorkflowCompleted = (message: string) => {
    setSuccess(message);
    closeOverlay();
    void loadTranscripts();
  };

  const handleSort = (key: TranscriptListSortKey) => {
    if (sortBy === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
    resetPage();
  };

  const handleAction = async (action: TranscriptListInlineAction, row: TranscriptRecord) => {
    setSuccess('');
    setError('');
    setSelectedTranscript(row);

    switch (action) {
      case 'edit':
        setOverlayMode('edit');
        onFormOpenChange?.(true);
        return;
      case 'files':
        setOverlayMode('files');
        onFormOpenChange?.(true);
        return;
      case 'edited':
        setOverlayMode('edited');
        onFormOpenChange?.(true);
        return;
      case 'reviewed':
        setOverlayMode('reviewed');
        onFormOpenChange?.(true);
        return;
      case 'publish':
        setOverlayMode('publish');
        return;
      case 'report':
        setOverlayMode('report');
        return;
      case 'download': {
        const target = getTranscriptDownloadTarget(row);
        if (!target) return;
        setDownloadingId(row.id);
        try {
          await downloadTranscriptFile(row.id, target.slot, target.fileId, target.name);
        } catch (err) {
          setError(parseActionError((err as Error).message, t));
        } finally {
          setDownloadingId(null);
        }
        return;
      }
      default:
        return;
    }
  };

  const actionLabel = (action: TranscriptListInlineAction): string => {
    switch (action) {
      case 'edit':
        return t('edit');
      case 'edited':
        return t('transcriptActionEdited');
      case 'reviewed':
        return t('transcriptActionReviewed');
      case 'publish':
        return t('transcriptActionPublish');
      case 'report':
        return t('report');
      case 'files':
        return t('files');
      case 'download':
        return t('download');
      default:
        return action;
    }
  };

  if (overlayMode === 'edit' && selectedTranscript) {
    return (
      <TranscriptDetailsForm
        transcriptId={selectedTranscript.id}
        onCancel={closeOverlay}
        onSaved={handleWorkflowCompleted}
      />
    );
  }

  if (overlayMode === 'files' && selectedTranscript) {
    return <TranscriptFilesList transcriptId={selectedTranscript.id} onClose={closeOverlay} />;
  }

  if (overlayMode === 'edited' && selectedTranscript) {
    return (
      <SubmitEditedTranscriptWorkflow
        transcript={selectedTranscript}
        onCancel={closeOverlay}
        onCompleted={handleWorkflowCompleted}
      />
    );
  }

  if (overlayMode === 'reviewed' && selectedTranscript) {
    return (
      <SubmitReviewedTranscriptWorkflow
        transcript={selectedTranscript}
        onCancel={closeOverlay}
        onCompleted={handleWorkflowCompleted}
      />
    );
  }

  return (
    <div className="transcripts-panel">
      <div className="filters">
        <div className="filters-title">{t('filterTranscripts')}</div>
        <div className="filters-row">
          {showCustomerFilter ? (
            <label className="filter-select">
              <span className="sr-only">{t('customer')}</span>
              <select
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setProjectId('');
                  resetPage();
                }}
              >
                <option value="">{t('allCustomers')}</option>
                {filterOptions.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="filter-select">
            <span className="sr-only">{t('project')}</span>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                resetPage();
              }}
            >
              <option value="">{t('allProjects')}</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            <span className="sr-only">{t('status')}</span>
            <select
              value={jobStatus}
              onChange={(event) => {
                setJobStatus(event.target.value);
                resetPage();
              }}
            >
              <option value="">{t('allStatuses')}</option>
              {filterOptions.statuses.map((option) => (
                <option key={option} value={option}>
                  {t(jobStatusLabelKey(option))}
                </option>
              ))}
            </select>
          </label>
          {showStenotypistFilter ? (
            <label className="filter-select">
              <span className="sr-only">{t('stenotypist')}</span>
              <select
                value={stenotypistUserId}
                onChange={(event) => {
                  setStenotypistUserId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allStenotypists')}</option>
                {filterOptions.stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {stenotypist.alias || stenotypist.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showEditorFilter ? (
            <label className="filter-select">
              <span className="sr-only">{t('editor')}</span>
              <select
                value={editorUserId}
                onChange={(event) => {
                  setEditorUserId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allEditors')}</option>
                {filterOptions.editors.map((editor) => (
                  <option key={editor.id} value={editor.id}>
                    {editor.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showReviewerFilter ? (
            <label className="filter-select">
              <span className="sr-only">{t('reviewer')}</span>
              <select
                value={reviewerUserId}
                onChange={(event) => {
                  setReviewerUserId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allReviewers')}</option>
                {filterOptions.reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showOwnerFilter ? (
            <label className="filter-select">
              <span className="sr-only">{t('transcriptOwners')}</span>
              <select
                value={transcriptOwnerUserId}
                onChange={(event) => {
                  setTranscriptOwnerUserId(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allTranscriptOwners')}</option>
                {filterOptions.transcriptOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.alias || owner.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="filters-row">
          <label className="date-field">
            <span>{t('dateFrom')}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                resetPage();
              }}
            />
          </label>
          <label className="date-field">
            <span>{t('dateTo')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                resetPage();
              }}
            />
          </label>
          <div className="filters-actions">
            <label className="auto-refresh">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              <span>
                {t('autoRefresh')}: {autoRefresh ? t('on') : t('off')}
              </span>
            </label>
            <input
              type="search"
              className="search-input"
              placeholder={t('search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
            <button
              type="button"
              className="refresh-btn"
              aria-label={t('refresh')}
              onClick={() => void loadTranscripts()}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
      {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}

      <div className="table-wrapper transcripts-table-scroll">
        <table className="transcripts-table">
          <thead>
            <tr>
              <SortableHeader label={t('jobNumber')} sortKey="jobNumber" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('status')} sortKey="jobStatus" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('customer')} sortKey="customerName" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('project')} sortKey="projectNumber" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('stenotypist')} sortKey="stenotypistName" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('editor')} sortKey="editorName" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('reviewer')} sortKey="reviewerName" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('publisher')} sortKey="publisherName" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <th>{t('expedite')}</th>
              <th>{t('bypassApproval')}</th>
              <th>{t('jobEndTime')}</th>
              <th>{t('serviceLevelAgreement')}</th>
              <SortableHeader label={t('deadline')} sortKey="deadlineMinutes" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label={t('ete')} sortKey="eteMinutes" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
              <th>{t('editDuration')}</th>
              <th>{t('transcriptOwners')}</th>
              <th className="actions-col">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={17} className="empty-row">
                  {t('loading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={17} className="empty-row">
                  {t('noTranscriptsFound')}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const actions = getTranscriptListInlineActions(
                  row,
                  authUser?.roles ?? authUser?.role,
                  authUser?.id ?? '',
                );
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="job-link">{row.jobNumber}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${row.jobStatus}`}>
                        {formatTranscriptJobStatus(row.jobStatus, t)}
                      </span>
                    </td>
                    <td>{row.customerName || '—'}</td>
                    <td className="project-cell">{row.projectNumber || '—'}</td>
                    <td>{row.stenotypistAlias || row.stenotypistName || '—'}</td>
                    <td>{row.editorName || '—'}</td>
                    <td>{row.reviewerName || '—'}</td>
                    <td>{row.publisherName || '—'}</td>
                    <td className="center">{row.expedite ? '✓' : ''}</td>
                    <td className="center">{row.bypassApproval ? '✓' : ''}</td>
                    <td>{row.jobEndTime || row.endTimeStenotypist || '—'}</td>
                    <td>{row.serviceLevelAgreement || '—'}</td>
                    <td>{formatTranscriptListDeadline(row, t)}</td>
                    <td>{formatTranscriptEte(row.pageCount)}</td>
                    <td>{formatTranscriptListEditDuration(row)}</td>
                    <td>{formatTranscriptOwnerLabels(row.transcriptOwnerLabels)}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        {actions.map((action) => (
                          <button
                            key={`${row.id}-${action}`}
                            type="button"
                            disabled={action === 'download' && downloadingId === row.id}
                            onClick={() => void handleAction(action, row)}
                          >
                            {action === 'download' && downloadingId === row.id
                              ? t('downloading')
                              : actionLabel(action)}
                          </button>
                        ))}
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
          <button type="button" className="pagination-btn" disabled={currentPage <= 1 || totalEntries === 0} onClick={() => setPage(1)}>
            {t('first')}
          </button>
          <button type="button" className="pagination-btn" disabled={currentPage <= 1 || totalEntries === 0} onClick={() => setPage((current) => current - 1)}>
            {t('previous')}
          </button>
          <span className="pagination-page">{currentPage}</span>
          <button type="button" className="pagination-btn" disabled={currentPage >= totalPages || totalEntries === 0} onClick={() => setPage((current) => current + 1)}>
            {t('next')}
          </button>
          <button type="button" className="pagination-btn" disabled={currentPage >= totalPages || totalEntries === 0} onClick={() => setPage(totalPages)}>
            {t('last')}
          </button>
        </div>
      </div>

      {overlayMode === 'publish' && selectedTranscript ? (
        <PublishTranscriptDialog
          transcript={selectedTranscript}
          onCancel={closeOverlay}
          onSaved={handleWorkflowCompleted}
        />
      ) : null}

      {overlayMode === 'report' && selectedTranscript ? (
        <TranscriptReportDialog transcript={selectedTranscript} onClose={closeOverlay} />
      ) : null}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortBy,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKey: TranscriptListSortKey;
  sortBy: TranscriptListSortKey;
  sortDirection: TranscriptListSortDirection;
  onSort: (key: TranscriptListSortKey) => void;
}) {
  const indicator = sortBy === sortKey ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th>
      <button type="button" className="table-sort-btn" onClick={() => onSort(sortKey)}>
        {label}
        {indicator}
      </button>
    </th>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}
