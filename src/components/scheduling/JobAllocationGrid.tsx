import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { fetchJobMatrix } from '../../api/jobMatrix';
import { confirmAllPendingJobs, matrixAllocateJob, matrixUnassignJob } from '../../api/jobs';
import { fetchPublicHolidayRecords } from '../../api/publicHolidays';
import { jobStatusLabelKey } from '../../config/job';
import {
  JOB_MATRIX_HEIGHT_PX,
  JOB_MATRIX_WIDTH_PX,
  MATRIX_METRIC_KEYS,
  SCHEDULE_PANEL_MIN_WIDTH_PX,
  SCHEDULE_WEEKDAY_COLUMN_WIDTH_PX,
  SCHEDULE_WEEKEND_COLUMN_WIDTH_PX,
  type MatrixMetricKey,
} from '../../config/jobMatrix';
import {
  formatAllocationDateKey,
  formatMatrixDayLabel,
  isWeekendDate,
  mockMatrixPublicHolidayDates,
  type MatrixCellEntry,
} from '../../data/mockJobAllocation';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type {
  JobMatrixMetrics,
  JobMatrixStenotypistInfo,
  JobMatrixStenotypistRow,
  JobMatrixUnassignedJob,
} from '../../types/jobMatrix';
import {
  buildHolidayDateSet,
  getMatrixScheduleDays,
  getNextWorkingDay,
  isMatrixCenterColumn,
  parseMatrixDateKey,
  shiftMatrixCenterDay,
  shiftMatrixCenterWeek,
} from '../../utils/jobMatrixDates';
import {
  MATRIX_DRAGGABLE_JOB_STATUSES,
  MATRIX_UNASSIGNABLE_JOB_STATUSES,
} from '../../config/allocationJobStatus';
import {
  MATRIX_JOB_DRAG_TYPE,
  readMatrixJobDragData,
  writeMatrixJobDragData,
  type MatrixJobDragData,
} from '../../utils/matrixDrag';
import ProjectDetailsForm from '../projects/ProjectDetailsForm';
import JobDetailsForm from './JobDetailsForm';
import { parseJobActionError } from './JobRejectDialog';
import StenotypistInfoPanel from './StenotypistInfoPanel';
import StenotypistLeaveDetailsForm from './StenotypistLeaveDetailsForm';
import '../../styles/job-allocation.css';
import '../../styles/profile.css';

type MatrixFormMode =
  | 'closed'
  | 'createJob'
  | 'createProject'
  | 'createLeave'
  | 'editJob'
  | 'editLeave';

const metricLabelKeys: Record<MatrixMetricKey, TranslationKey> = {
  m1: 'colM1',
  m2: 'colM2',
  m3: 'colM3',
  m4: 'colM4',
  m5: 'colM5',
  m6: 'colM6',
  m7: 'colM7',
  m8: 'colM8',
  m9: 'colM9',
};

export default function JobAllocationGrid() {
  const { language, t } = useLanguage();
  const [holidayDates, setHolidayDates] = useState<Set<string>>(
    () => new Set(mockMatrixPublicHolidayDates),
  );
  const [centerDate, setCenterDate] = useState(() =>
    getNextWorkingDay(new Date(), mockMatrixPublicHolidayDates),
  );
  const [formMode, setFormMode] = useState<MatrixFormMode>('closed');
  const [editEntityId, setEditEntityId] = useState('');
  const [stenotypists, setStenotypists] = useState<JobMatrixStenotypistRow[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<JobMatrixUnassignedJob[]>([]);
  const [infoPanelStenotypist, setInfoPanelStenotypist] = useState<JobMatrixStenotypistInfo | null>(
    null,
  );
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [matrixActionLoading, setMatrixActionLoading] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const locale = language === 'el' ? 'el-GR' : 'en-GB';

  const scheduleDays = useMemo(() => getMatrixScheduleDays(centerDate), [centerDate]);
  const centerDateKey = formatAllocationDateKey(centerDate);
  const nextWorkingDayKey = useMemo(
    () => formatAllocationDateKey(getNextWorkingDay(new Date(), holidayDates)),
    [holidayDates],
  );

  useEffect(() => {
    void fetchPublicHolidayRecords()
      .then((records) => {
        const dates = buildHolidayDateSet(records, mockMatrixPublicHolidayDates);
        setHolidayDates(dates);
        setCenterDate(getNextWorkingDay(new Date(), dates));
      })
      .catch(() => {
        setHolidayDates(new Set(mockMatrixPublicHolidayDates));
      });
  }, []);

  const loadMatrix = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const data = await fetchJobMatrix(centerDateKey);
      setStenotypists(data.stenotypists);
      setUnassignedJobs(data.unassignedJobs);
      setError('');
    } catch {
      setStenotypists([]);
      setUnassignedJobs([]);
      setError(t('jobMatrixLoadError'));
    } finally {
      setLoadingMatrix(false);
    }
  }, [centerDateKey, t]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  const moveWeek = (offset: number) => {
    setCenterDate((current) => shiftMatrixCenterWeek(current, offset));
  };

  const moveDay = (offset: number) => {
    setCenterDate((current) => shiftMatrixCenterDay(current, offset));
  };

  const handleCalendarSelect = (dateKey: string) => {
    setCenterDate(parseMatrixDateKey(dateKey));
  };

  const handleDayColumnSelect = (day: Date) => {
    setCenterDate(parseMatrixDateKey(formatAllocationDateKey(day)));
  };

  const handleCloseForm = () => {
    setFormMode('closed');
    setEditEntityId('');
  };

  const handleFormSaved = (message: string) => {
    setFormMode('closed');
    setEditEntityId('');
    setSuccess(message);
    void loadMatrix();
  };

  const handleEditJob = (jobId: string) => {
    setEditEntityId(jobId);
    setFormMode('editJob');
  };

  const handleEditLeave = (leaveId: string) => {
    setEditEntityId(leaveId);
    setFormMode('editLeave');
  };

  const handleMatrixAllocate = async (
    dragData: MatrixJobDragData,
    stenotypistUserId: string,
    dateKey: string,
  ) => {
    if (
      dragData.source === 'schedule' &&
      dragData.stenotypistUserId === stenotypistUserId &&
      dragData.dateKey === dateKey
    ) {
      return;
    }

    setMatrixActionLoading(true);
    setError('');
    try {
      await matrixAllocateJob(dragData.jobId, { stenotypistUserId, date: dateKey });
      const isReassign =
        dragData.source === 'schedule' &&
        (dragData.stenotypistUserId !== stenotypistUserId || dragData.dateKey !== dateKey);
      setSuccess(t(isReassign ? 'jobMatrixReassignSuccess' : 'jobMatrixAllocateSuccess'));
      await loadMatrix();
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobMatrixDragError'));
    } finally {
      setMatrixActionLoading(false);
      setDropTarget(null);
    }
  };

  const handleMatrixUnassign = async (dragData: MatrixJobDragData) => {
    if (
      dragData.source !== 'schedule' ||
      !MATRIX_UNASSIGNABLE_JOB_STATUSES.has(dragData.jobStatus)
    ) {
      return;
    }

    setMatrixActionLoading(true);
    setError('');
    try {
      await matrixUnassignJob(dragData.jobId);
      setSuccess(t('jobMatrixUnassignSuccess'));
      await loadMatrix();
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobMatrixDragError'));
    } finally {
      setMatrixActionLoading(false);
      setDropTarget(null);
    }
  };

  const handleScheduleDragOver = (
    event: DragEvent<HTMLTableCellElement>,
    targetKey: string,
    canDrop: boolean,
  ) => {
    if (!canDrop) return;
    if (!event.dataTransfer.types.includes(MATRIX_JOB_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(targetKey);
  };

  const handleScheduleDrop = async (
    event: DragEvent<HTMLTableCellElement>,
    stenotypistUserId: string,
    dateKey: string,
    canDrop: boolean,
  ) => {
    event.preventDefault();
    setDropTarget(null);
    if (!canDrop || matrixActionLoading) return;

    const dragData = readMatrixJobDragData(event.dataTransfer);
    if (!dragData || !MATRIX_DRAGGABLE_JOB_STATUSES.has(dragData.jobStatus)) return;

    await handleMatrixAllocate(dragData, stenotypistUserId, dateKey);
  };

  const handleUnassignedDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(MATRIX_JOB_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget('unassigned');
  };

  const handleUnassignedDragLeave = () => {
    setDropTarget((current) => (current === 'unassigned' ? null : current));
  };

  const handleScheduleDragLeave = (targetKey: string) => {
    setDropTarget((current) => (current === targetKey ? null : current));
  };

  const handleUnassignedDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropTarget(null);
    if (matrixActionLoading) return;

    const dragData = readMatrixJobDragData(event.dataTransfer);
    if (!dragData) return;

    await handleMatrixUnassign(dragData);
  };

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    setError('');
    try {
      await confirmAllPendingJobs();
      setSuccess(t('jobConfirmAllSuccess'));
      await loadMatrix();
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
    } finally {
      setConfirmingAll(false);
    }
  };

  return (
    <div className="allocation-page job-matrix-page">
      <div className="page-header allocation-header">
        <div>
          <h1 className="page-title">{t('jobMatrix')}</h1>
          <p className="page-subtitle">{t('jobMatrixSubtitle')}</p>
        </div>
      </div>

      {success && <div className="profile-alert profile-alert-success">{success}</div>}
      {error && formMode === 'closed' && (
        <div className="profile-alert profile-alert-error">{error}</div>
      )}

      {infoPanelStenotypist ? (
        <StenotypistInfoPanel
          stenotypistUserId={infoPanelStenotypist.id}
          centerDate={centerDateKey}
          onClose={() => setInfoPanelStenotypist(null)}
        />
      ) : null}

      {formMode === 'createJob' ? (
        <JobDetailsForm mode="create" onCancel={handleCloseForm} onSaved={handleFormSaved} />
      ) : null}

      {formMode === 'createProject' ? (
        <ProjectDetailsForm mode="create" onCancel={handleCloseForm} onSaved={handleFormSaved} />
      ) : null}

      {formMode === 'createLeave' ? (
        <StenotypistLeaveDetailsForm mode="create" onCancel={handleCloseForm} onSaved={handleFormSaved} />
      ) : null}

      {formMode === 'editJob' && editEntityId ? (
        <JobDetailsForm
          mode="edit"
          jobId={editEntityId}
          onCancel={handleCloseForm}
          onSaved={handleFormSaved}
        />
      ) : null}

      {formMode === 'editLeave' && editEntityId ? (
        <StenotypistLeaveDetailsForm
          mode="edit"
          leaveId={editEntityId}
          onCancel={handleCloseForm}
          onSaved={handleFormSaved}
        />
      ) : null}

      {formMode === 'closed' ? (
        <div
          className="job-matrix-workspace"
          style={{ width: JOB_MATRIX_WIDTH_PX, height: JOB_MATRIX_HEIGHT_PX }}
        >
          <div className="job-matrix-toolbar">
            <section className="job-matrix-actions" aria-label={t('jobMatrixActions')}>
              <button type="button" className="btn-primary" onClick={() => setFormMode('createJob')}>
                {t('addJob')}
              </button>
              <button type="button" className="btn-primary" onClick={() => setFormMode('createProject')}>
                {t('addProject')}
              </button>
              <button type="button" className="btn-primary" onClick={() => setFormMode('createLeave')}>
                {t('addLeave')}
              </button>
              <button
                type="button"
                className="btn-confirm"
                onClick={() => void handleConfirmAll()}
                disabled={confirmingAll || loadingMatrix}
              >
                {confirmingAll ? t('saving') : t('confirmAll')}
              </button>
            </section>

            <section
              className="job-matrix-date-selection"
              aria-label={t('jobMatrixDateSelection')}
            >
              <button type="button" className="date-nav-btn" onClick={() => moveWeek(-1)} title={t('previousWeek')}>
                |&lt;&lt;
              </button>
              <button type="button" className="date-nav-btn" onClick={() => moveDay(-1)} title={t('previous')}>
                &lt;&lt;
              </button>
              <label className="allocation-calendar-label">
                <span className="allocation-calendar-text">{t('calendar')}</span>
                <input
                  type="date"
                  className="allocation-date-picker"
                  value={centerDateKey}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    handleCalendarSelect(e.target.value);
                  }}
                />
              </label>
              <button type="button" className="date-nav-btn" onClick={() => moveDay(1)} title={t('next')}>
                &gt;&gt;
              </button>
              <button type="button" className="date-nav-btn" onClick={() => moveWeek(1)} title={t('nextWeek')}>
                &gt;&gt;|
              </button>
            </section>
          </div>

          <div className="job-matrix-body">
            <div className="job-matrix-grid-region">
              <section
                className="stenotypist-list-panel"
                aria-label={t('stenotypistListPanel')}
              >
                <div className="stenotypist-list-scroll">
                  <table className="allocation-table job-matrix-table stenotypist-list-table">
                    <thead>
                      <tr>
                        <th className="col-st">{t('st')}</th>
                        <th className="col-info">{t('stenotypistInfo')}</th>
                        {MATRIX_METRIC_KEYS.map((key, index) => (
                          <th
                            key={key}
                            className={`metric-col${index === MATRIX_METRIC_KEYS.length - 1 ? ' col-metric-boundary' : ''}`}
                          >
                            {t(metricLabelKeys[key])}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stenotypists.length === 0 ? (
                        <tr>
                          <td colSpan={2 + MATRIX_METRIC_KEYS.length} className="empty-row">
                            {loadingMatrix ? t('loading') : t('noAllocationRows')}
                          </td>
                        </tr>
                      ) : (
                        stenotypists.map((row) => (
                          <tr key={row.id}>
                            <td className="col-st staff-code">{row.alias}</td>
                            <td className="col-info">
                              <button
                                type="button"
                                className="info-btn"
                                aria-label={t('stenotypistInfo')}
                                onClick={() => setInfoPanelStenotypist(row.info)}
                              >
                                <PlayIcon />
                              </button>
                            </td>
                            {MATRIX_METRIC_KEYS.map((key, index) => (
                              <MetricCell
                                key={key}
                                metricKey={key}
                                metrics={row.metrics}
                                isBoundary={index === MATRIX_METRIC_KEYS.length - 1}
                              />
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="schedule-panel" aria-label={t('schedulePanel')}>
                <div
                  className="schedule-panel-scroll"
                  style={{
                    ['--schedule-weekday-width' as string]: `${SCHEDULE_WEEKDAY_COLUMN_WIDTH_PX}px`,
                    ['--schedule-weekend-width' as string]: `${SCHEDULE_WEEKEND_COLUMN_WIDTH_PX}px`,
                  }}
                >
                  <table
                    className="allocation-table job-matrix-table schedule-panel-table"
                    style={{ minWidth: SCHEDULE_PANEL_MIN_WIDTH_PX }}
                  >
                    <thead>
                      <tr>
                        {scheduleDays.map((day, columnIndex) => {
                          const dateKey = formatAllocationDateKey(day);
                          return (
                            <th
                              key={dateKey}
                              className={getMatrixDayColumnClass(
                                day,
                                columnIndex,
                                holidayDates,
                              )}
                              onClick={() => handleDayColumnSelect(day)}
                            >
                              {formatMatrixDayLabel(day, locale)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {stenotypists.length === 0 ? (
                        <tr>
                          <td colSpan={scheduleDays.length} className="empty-row">
                            {loadingMatrix ? t('loading') : t('noAllocationRows')}
                          </td>
                        </tr>
                      ) : (
                        stenotypists.map((row) => (
                          <ScheduleRow
                            key={row.id}
                            row={row}
                            scheduleDays={scheduleDays}
                            holidayDates={holidayDates}
                            dropTarget={dropTarget}
                            matrixActionLoading={matrixActionLoading}
                            t={t}
                            onEditJob={handleEditJob}
                            onEditLeave={handleEditLeave}
                            onScheduleDragOver={handleScheduleDragOver}
                            onScheduleDragLeave={handleScheduleDragLeave}
                            onScheduleDrop={handleScheduleDrop}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <UnassignedJobsPanel
              jobs={unassignedJobs}
              nextWorkingDayKey={nextWorkingDayKey}
              dropTarget={dropTarget}
              matrixActionLoading={matrixActionLoading}
              t={t}
              onEditJob={handleEditJob}
              onDragOver={handleUnassignedDragOver}
              onDragLeave={handleUnassignedDragLeave}
              onDrop={handleUnassignedDrop}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCell({
  metricKey,
  metrics,
  isBoundary,
}: {
  metricKey: MatrixMetricKey;
  metrics: JobMatrixMetrics;
  isBoundary: boolean;
}) {
  const value = metrics[metricKey];
  const className = [
    'metric-col',
    isBoundary ? 'col-metric-boundary' : '',
    metricKey === 'm1' && (value === 'OUT' || value === 'LEA') ? 'metric-code' : '',
    metricKey === 'm8' && metrics.m8Late ? 'metric-late' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <td className={className}>{value}</td>;
}

function getMatrixDayColumnClass(
  day: Date,
  columnIndex: number,
  holidayDates: ReadonlySet<string>,
): string {
  const dateKey = formatAllocationDateKey(day);
  const isFocalDay = isMatrixCenterColumn(columnIndex);
  return [
    'day-col',
    isWeekendDate(day) ? 'day-col-weekend' : '',
    holidayDates.has(dateKey) ? 'day-col-holiday' : '',
    isFocalDay ? 'day-col-focal' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function isApprovedLeaveDay(entries: MatrixCellEntry[]): boolean {
  return entries.some((entry) => entry.kind === 'leave_approved');
}

function scheduleDropTargetKey(stenotypistUserId: string, dateKey: string): string {
  return `${stenotypistUserId}:${dateKey}`;
}

function ScheduleRow({
  row,
  scheduleDays,
  holidayDates,
  dropTarget,
  matrixActionLoading,
  t,
  onEditJob,
  onEditLeave,
  onScheduleDragOver,
  onScheduleDragLeave,
  onScheduleDrop,
}: {
  row: JobMatrixStenotypistRow;
  scheduleDays: Date[];
  holidayDates: ReadonlySet<string>;
  dropTarget: string | null;
  matrixActionLoading: boolean;
  t: (key: TranslationKey) => string;
  onEditJob: (jobId: string) => void;
  onEditLeave: (leaveId: string) => void;
  onScheduleDragOver: (
    event: DragEvent<HTMLTableCellElement>,
    targetKey: string,
    canDrop: boolean,
  ) => void;
  onScheduleDrop: (
    event: DragEvent<HTMLTableCellElement>,
    stenotypistUserId: string,
    dateKey: string,
    canDrop: boolean,
  ) => void;
  onScheduleDragLeave: (targetKey: string) => void;
}) {
  return (
    <tr>
      {scheduleDays.map((day, columnIndex) => {
        const dateKey = formatAllocationDateKey(day);
        const entries = row.schedule[dateKey] ?? [];
        const targetKey = scheduleDropTargetKey(row.id, dateKey);
        const canDrop = !isApprovedLeaveDay(entries) && !matrixActionLoading;
        const isDropTarget = dropTarget === targetKey;
        return (
          <td
            key={dateKey}
            className={[
              getMatrixDayColumnClass(day, columnIndex, holidayDates),
              isDropTarget ? 'day-cell-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(event) => onScheduleDragOver(event, targetKey, canDrop)}
            onDragLeave={() => onScheduleDragLeave(targetKey)}
            onDrop={(event) => void onScheduleDrop(event, row.id, dateKey, canDrop)}
          >
            <div className="day-cell">
              {entries.map((entry) => (
                <MatrixCellCard
                  key={entry.id}
                  entry={entry}
                  stenotypistUserId={row.id}
                  dateKey={dateKey}
                  t={t}
                  onEditJob={onEditJob}
                  onEditLeave={onEditLeave}
                />
              ))}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function MatrixCellCard({
  entry,
  stenotypistUserId,
  dateKey,
  t,
  onEditJob,
  onEditLeave,
}: {
  entry: MatrixCellEntry;
  stenotypistUserId: string;
  dateKey: string;
  t: (key: TranslationKey) => string;
  onEditJob: (jobId: string) => void;
  onEditLeave: (leaveId: string) => void;
}) {
  if (entry.kind === 'leave_request') {
    return (
      <button
        type="button"
        className="matrix-leave matrix-leave-request"
        onClick={(event) => {
          event.stopPropagation();
          onEditLeave(entry.id);
        }}
      >
        {t('leaveRequest')}
      </button>
    );
  }

  if (entry.kind === 'leave_approved') {
    return (
      <button
        type="button"
        className="matrix-leave matrix-leave-approved"
        onClick={(event) => {
          event.stopPropagation();
          onEditLeave(entry.id);
        }}
      >
        {t('leaveApproved')}
      </button>
    );
  }

  const isDraggable = MATRIX_DRAGGABLE_JOB_STATUSES.has(entry.jobStatus);

  return (
    <button
      type="button"
      className={[
        'allocation-job',
        `allocation-job-${entry.status}`,
        isDraggable ? 'allocation-job-draggable' : 'allocation-job-locked',
      ].join(' ')}
      draggable={isDraggable}
      onClick={() => onEditJob(entry.id)}
      onDragStart={(event) => {
        event.stopPropagation();
        if (!isDraggable) {
          event.preventDefault();
          return;
        }
        writeMatrixJobDragData(event.dataTransfer, {
          jobId: entry.id,
          source: 'schedule',
          jobStatus: entry.jobStatus,
          stenotypistUserId,
          dateKey,
        });
      }}
      title={`${entry.title} (${t(jobStatusLabelKey(entry.jobStatus))})`}
    >
      <div className="allocation-job-field">{entry.customerAlias}</div>
      <div className="allocation-job-field">{entry.district}</div>
      <div className="allocation-job-field">{entry.projectField1}</div>
      <div className="allocation-job-field">{entry.projectField2}</div>
      <div className="allocation-job-field">{entry.projectField3}</div>
      <div className="allocation-job-time">{entry.time}</div>
    </button>
  );
}

function UnassignedJobsPanel({
  jobs,
  nextWorkingDayKey,
  dropTarget,
  matrixActionLoading,
  t,
  onEditJob,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  jobs: JobMatrixUnassignedJob[];
  nextWorkingDayKey: string;
  dropTarget: string | null;
  matrixActionLoading: boolean;
  t: (key: TranslationKey) => string;
  onEditJob: (jobId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  const [customerFilter, setCustomerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(nextWorkingDayKey);
  const dateFilterUserSet = useRef(false);

  useEffect(() => {
    if (!dateFilterUserSet.current) {
      setDateFilter(nextWorkingDayKey);
    }
  }, [nextWorkingDayKey]);

  const customerOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.customerAlias))].sort(),
    [jobs],
  );
  const locationOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.district))].sort(),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (customerFilter && job.customerAlias !== customerFilter) return false;
      if (locationFilter && job.district !== locationFilter) return false;
      if (dateFilter && job.date !== dateFilter) return false;
      return true;
    });
  }, [jobs, customerFilter, locationFilter, dateFilter]);

  return (
    <section
      className={[
        'unassigned-jobs-panel',
        dropTarget === 'unassigned' ? 'unassigned-jobs-panel-drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={t('unassignedJobsPanel')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => void onDrop(event)}
    >
      <h2 className="unassigned-jobs-title">{t('unassignedJobs')}</h2>
      <div className="unassigned-jobs-filters">
        <label className="unassigned-filter-field">
          <span>{t('customer')}</span>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">{t('allCustomers')}</option>
            {customerOptions.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </label>
        <label className="unassigned-filter-field">
          <span>{t('location')}</span>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">{t('allLocations')}</option>
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>
        <label className="unassigned-filter-field">
          <span>{t('date')}</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              dateFilterUserSet.current = true;
              setDateFilter(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="unassigned-jobs-list">
        {filteredJobs.length === 0 ? (
          <p className="unassigned-jobs-empty">{t('noUnassignedJobs')}</p>
        ) : (
          filteredJobs.map((job) => (
            <UnassignedJobCard
              key={job.id}
              job={job}
              disabled={matrixActionLoading}
              onEditJob={onEditJob}
            />
          ))
        )}
      </div>
    </section>
  );
}

function UnassignedJobCard({
  job,
  disabled,
  onEditJob,
}: {
  job: JobMatrixUnassignedJob;
  disabled: boolean;
  onEditJob: (jobId: string) => void;
}) {
  const isDraggable = !disabled && MATRIX_DRAGGABLE_JOB_STATUSES.has(job.jobStatus);

  return (
    <button
      type="button"
      className="unassigned-job-card"
      draggable={isDraggable}
      onClick={() => onEditJob(job.id)}
      onDragStart={(event) => {
        if (!isDraggable) {
          event.preventDefault();
          return;
        }
        writeMatrixJobDragData(event.dataTransfer, {
          jobId: job.id,
          source: 'unassigned',
          jobStatus: job.jobStatus,
        });
      }}
      title={job.title}
    >
      <div className="allocation-job-field">{job.customerAlias}</div>
      <div className="allocation-job-field">{job.district}</div>
      <div className="allocation-job-field">{job.projectField1}</div>
      <div className="allocation-job-field">{job.projectField2}</div>
      <div className="allocation-job-field">{job.projectField3}</div>
      <div className="allocation-job-time">{job.time}</div>
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
