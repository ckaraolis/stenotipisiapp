import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDistrictOptions } from '../../api/districts';
import {
  deleteProject,
  fetchProjectRecords,
  updateProjectStatus,
} from '../../api/projects';
import { travellingChargesLabelKey } from '../../config/customer';
import type { DistrictOption } from '../../types/district';
import type { ProjectRecord } from '../../types/project';
import CloseProjectDialog from './CloseProjectDialog';
import DeleteProjectDialog, { parseProjectDeleteError } from './DeleteProjectDialog';
import OpenProjectDialog from './OpenProjectDialog';
import ProjectDetailsForm from './ProjectDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'open' | 'closed' | '';

function projectStatusLabel(
  status: ProjectRecord['status'],
  t: (key: 'projectStatusOpen' | 'projectStatusClosed') => string,
): string {
  return status === 'closed' ? t('projectStatusClosed') : t('projectStatusOpen');
}

function formatTranscriptOwnerAliases(project: ProjectRecord): string {
  const aliases = project.transcriptOwners.map((owner) => owner.username).filter(Boolean);
  return aliases.length > 0 ? aliases.join(', ') : '—';
}

function displayFieldValue(value: string): string {
  return value.trim() ? value : '—';
}

export default function ProjectsTable() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scrollToTranscriptOwners, setScrollToTranscriptOwners] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [closeTarget, setCloseTarget] = useState<ProjectRecord | null>(null);
  const [closing, setClosing] = useState(false);
  const [openTarget, setOpenTarget] = useState<ProjectRecord | null>(null);
  const [opening, setOpening] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('');
  const [field1Filter, setField1Filter] = useState('');
  const [field2Filter, setField2Filter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchProjectRecords();
      setProjects(data);
    } catch {
      setError(t('projectsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    fetchDistrictOptions()
      .then(setDistricts)
      .catch(() => {
        // District filter falls back to values from project rows.
      });
  }, []);

  const customerOptions = useMemo(() => {
    const options = new Map<string, string>();
    projects.forEach((project) => {
      options.set(project.customerId, project.customerName);
    });
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [projects]);

  const field1Options = useMemo(() => {
    const options = new Map<string, string>();
    projects.forEach((project) => {
      if (project.field1ValueId && project.field1Value) {
        options.set(project.field1ValueId, project.field1Value);
      }
    });
    return [...options.entries()]
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }));
  }, [projects]);

  const field2Options = useMemo(() => {
    const options = new Map<string, string>();
    projects.forEach((project) => {
      if (project.field2ValueId && project.field2Value) {
        options.set(project.field2ValueId, project.field2Value);
      }
    });
    return [...options.entries()]
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }));
  }, [projects]);

  const districtOptions = useMemo(() => {
    if (districts.length > 0) {
      return districts;
    }
    const options = new Map<string, string>();
    projects.forEach((project) => {
      if (project.districtId) {
        options.set(project.districtId, project.districtName);
      }
    });
    return [...options.entries()].map(([id, name]) => ({ id, name }));
  }, [districts, projects]);

  const filteredRows = useMemo(() => {
    return projects.filter((row) => {
      if (statusFilter === 'open' && row.status !== 'open') return false;
      if (statusFilter === 'closed' && row.status !== 'closed') return false;
      if (customerFilter && row.customerId !== customerFilter) return false;
      if (districtFilter && row.districtId !== districtFilter) return false;
      if (field1Filter && row.field1ValueId !== field1Filter) return false;
      if (field2Filter && row.field2ValueId !== field2Filter) return false;
      return true;
    });
  }, [projects, statusFilter, customerFilter, districtFilter, field1Filter, field2Filter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const comparison = a.projectNumber.localeCompare(b.projectNumber, undefined, {
        numeric: true,
      });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedProjectId(null);
    setScrollToTranscriptOwners(false);
    setSuccess('');
    setError('');
  };

  const handleOpenEdit = (projectId: string, focusTranscriptOwners = false) => {
    setFormMode('edit');
    setSelectedProjectId(projectId);
    setScrollToTranscriptOwners(focusTranscriptOwners);
    setSuccess('');
    setError('');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedProjectId(null);
    setScrollToTranscriptOwners(false);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedProjectId(null);
    setScrollToTranscriptOwners(false);
    setSuccess(message);
    await loadProjects();
  };

  const handleDeleteRequest = (project: ProjectRecord) => {
    setDeleteError('');
    setDeleteTarget(project);
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
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('projectDeletedSuccess'));
      await loadProjects();
    } catch (err) {
      setDeleteError(parseProjectDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseRequest = (project: ProjectRecord) => {
    setCloseTarget(project);
  };

  const handleCloseCancel = () => {
    setCloseTarget(null);
  };

  const handleCloseConfirm = async () => {
    if (!closeTarget) return;
    setClosing(true);
    setError('');
    try {
      await updateProjectStatus(closeTarget.id, 'closed');
      setCloseTarget(null);
      setSuccess(t('projectClosedSuccess'));
      await loadProjects();
    } catch {
      setError(t('projectStatusUpdateError'));
    } finally {
      setClosing(false);
    }
  };

  const handleOpenRequest = (project: ProjectRecord) => {
    setOpenTarget(project);
  };

  const handleOpenCancel = () => {
    setOpenTarget(null);
  };

  const handleOpenConfirm = async () => {
    if (!openTarget) return;
    setOpening(true);
    setError('');
    try {
      await updateProjectStatus(openTarget.id, 'open');
      setOpenTarget(null);
      setSuccess(t('projectOpenedSuccess'));
      await loadProjects();
    } catch {
      setError(t('projectStatusUpdateError'));
    } finally {
      setOpening(false);
    }
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    resetPage();
  };

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('projectsList')}</h1>
          <p className="page-subtitle">{t('projectsListSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <ProjectDetailsForm
          mode={formMode}
          projectId={selectedProjectId ?? undefined}
          scrollToTranscriptOwners={scrollToTranscriptOwners}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
          onTranscriptOwnersChanged={loadProjects}
        />
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          projectNumber={deleteTarget.projectNumber}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {closeTarget && (
        <CloseProjectDialog
          projectNumber={closeTarget.projectNumber}
          closing={closing}
          onCancel={handleCloseCancel}
          onConfirm={handleCloseConfirm}
        />
      )}

      {openTarget && (
        <OpenProjectDialog
          projectNumber={openTarget.projectNumber}
          opening={opening}
          onCancel={handleOpenCancel}
          onConfirm={handleOpenConfirm}
        />
      )}

      {formMode === 'closed' && (
        <div className="projects-panel">
          <div className="filters">
            <div className="filters-row">
              <label className="filter-select">
                <select
                  value={customerFilter}
                  onChange={(event) => {
                    setCustomerFilter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="">{t('allCustomers')}</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={field1Filter}
                  onChange={(event) => {
                    setField1Filter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="">{t('allField1')}</option>
                  {field1Options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={field2Filter}
                  onChange={(event) => {
                    setField2Filter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="">{t('allField2')}</option>
                  {field2Options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={districtFilter}
                  onChange={(event) => {
                    setDistrictFilter(event.target.value);
                    resetPage();
                  }}
                >
                  <option value="">{t('allDistricts')}</option>
                  {districtOptions.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-select">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    resetPage();
                  }}
                >
                  <option value="open">{t('openOnly')}</option>
                  <option value="closed">{t('projectStatusClosed')}</option>
                  <option value="">{t('allStatuses')}</option>
                </select>
              </label>
            </div>
          </div>

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
                          {t('projectNumber')}
                          <SortIcon direction={sortDirection} />
                        </button>
                      </th>
                      <th>{t('customer')}</th>
                      <th>{t('district')}</th>
                      <th>{t('field1')}</th>
                      <th>{t('field2')}</th>
                      <th>{t('field3')}</th>
                      <th>{t('field4')}</th>
                      <th>{t('travellingCharges')}</th>
                      <th>{t('status')}</th>
                      <th>{t('transcriptOwnerAliases')}</th>
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
                          <td>{row.projectNumber}</td>
                          <td>{row.customerName}</td>
                          <td>{row.districtName || '—'}</td>
                          <td>{displayFieldValue(row.field1Value)}</td>
                          <td>{displayFieldValue(row.field2Value)}</td>
                          <td>{displayFieldValue(row.field3)}</td>
                          <td>{displayFieldValue(row.field4)}</td>
                          <td>{t(travellingChargesLabelKey(row.travellingCharges))}</td>
                          <td>{projectStatusLabel(row.status, t)}</td>
                          <td>{formatTranscriptOwnerAliases(row)}</td>
                          <td className="actions-col">
                            <div className="row-actions">
                              <button type="button" onClick={() => handleOpenEdit(row.id)}>
                                {t('edit')}
                              </button>
                              <button type="button" onClick={() => handleDeleteRequest(row)}>
                                {t('delete')}
                              </button>
                              {row.status === 'open' ? (
                                <button type="button" onClick={() => handleCloseRequest(row)}>
                                  {t('close')}
                                </button>
                              ) : (
                                <button type="button" onClick={() => handleOpenRequest(row)}>
                                  {t('open')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row.id, true)}
                              >
                                {t('transcriptOwners')}
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
