import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteUser,
  fetchCustomers,
  fetchUsers,
  updateUserStatus,
  type CustomerOption,
  type UserProfile,
} from '../../api/profile';
import { USER_ROLES, formatRoleLabels, getRoleLabelKey } from '../../config/roles';
import type { UserRole } from '../../config/roles';
import DeleteUserDialog, { parseDeleteError } from './DeleteUserDialog';
import UserDetailsForm from './UserDetailsForm';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UserStatus } from '../../types/user';
import '../../styles/projects.css';
import '../../styles/profile.css';
import '../../styles/dashboard.css';
import '../../styles/financials.css';

const PAGE_SIZE = 20;

type FormMode = 'closed' | 'create' | 'edit';
type SortDirection = 'asc' | 'desc';

export default function UsersTable() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [customerFilter, setCustomerFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('active');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, customerData] = await Promise.all([fetchUsers(), fetchCustomers()]);
      setUsers(userData);
      setCustomers(customerData);
    } catch {
      setError(t('profileLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredRows = useMemo(() => {
    return users
      .filter((row) => {
        if (statusFilter && row.status !== statusFilter) return false;
        if (customerFilter && row.customerId !== customerFilter) return false;
        if (roleFilter && !row.roles.includes(roleFilter as UserRole)) return false;
        return true;
      })
      .sort((a, b) => {
        const comparison = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [users, statusFilter, customerFilter, roleFilter, sortDirection]);

  const totalEntries = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalEntries === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalEntries);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const handleOpenCreate = () => {
    setSuccess('');
    setError('');
    setSelectedUserId(null);
    setFormMode('create');
  };

  const handleOpenEdit = (userId: string) => {
    setSuccess('');
    setError('');
    setSelectedUserId(userId);
    setFormMode('edit');
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setSelectedUserId(null);
  };

  const handleSaved = async (message: string) => {
    setFormMode('closed');
    setSelectedUserId(null);
    setSuccess(message);
    await loadUsers();
  };

  const handleSetStatus = async (user: UserProfile, status: UserStatus) => {
    setActionUserId(user.id);
    setError('');
    try {
      await updateUserStatus(user.id, status);
      setSuccess(status === 'active' ? t('userActivatedSuccess') : t('userDeactivatedSuccess'));
      await loadUsers();
    } catch {
      setError(t('userStatusUpdateError'));
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteRequest = (user: UserProfile) => {
    setDeleteError('');
    setDeleteTarget(user);
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
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(t('userDeletedSuccess'));
      await loadUsers();
    } catch (err) {
      setDeleteError(parseDeleteError((err as Error).message, t));
    } finally {
      setDeleting(false);
    }
  };

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="projects-page">
      <div className="page-header projects-header">
        <div>
          <h1 className="page-title">{t('users')}</h1>
          <p className="page-subtitle">{t('usersSubtitle')}</p>
        </div>
        {formMode === 'closed' && (
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            {t('addNew')}
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <UserDetailsForm
          mode={formMode}
          userId={selectedUserId ?? undefined}
          onCancel={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteUserDialog
          userName={deleteTarget.fullName}
          error={deleteError}
          deleting={deleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <div className="projects-panel">
        <div className="filters">
          <div className="filters-row">
            <label className="filter-select">
              <select
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
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
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  resetPage();
                }}
              >
                <option value="">{t('allRoles')}</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(getRoleLabelKey(role))}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-select">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as UserStatus | '');
                  resetPage();
                }}
              >
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('statusActive')}</option>
                <option value="inactive">{t('statusInactive')}</option>
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
                        {t('fullName')}
                        <SortIcon direction={sortDirection} />
                      </button>
                    </th>
                    <th>{t('username')}</th>
                    <th>{t('email')}</th>
                    <th>{t('contactPhone')}</th>
                    <th>{t('mobilePhone')}</th>
                    <th>{t('customer')}</th>
                    <th>{t('language')}</th>
                    <th>{t('status')}</th>
                    <th>{t('roles')}</th>
                    <th className="actions-col">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="empty-row">
                        {t('noRecordsFound')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.fullName}</td>
                        <td>{row.username}</td>
                        <td>{row.email}</td>
                        <td>{row.contactPhone || '—'}</td>
                        <td>{row.mobilePhone || '—'}</td>
                        <td>{row.customerName ?? '—'}</td>
                        <td>{row.language === 'el' ? t('greek') : t('english')}</td>
                        <td>
                          <span className={`profile-status-badge profile-status-${row.status}`}>
                            {row.status === 'inactive' ? t('statusInactive') : t('statusActive')}
                          </span>
                        </td>
                        <td>{formatRoleLabels(row.roles, t)}</td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button type="button" onClick={() => handleOpenEdit(row.id)}>
                              {t('edit')}
                            </button>
                            <button type="button" onClick={() => handleDeleteRequest(row)}>
                              {t('delete')}
                            </button>
                            {row.status === 'active' ? (
                              <button
                                type="button"
                                disabled={actionUserId === row.id}
                                onClick={() => handleSetStatus(row, 'inactive')}
                              >
                                {t('disable')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionUserId === row.id}
                                onClick={() => handleSetStatus(row, 'active')}
                              >
                                {t('enable')}
                              </button>
                            )}
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
