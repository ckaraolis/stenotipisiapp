import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import {
  fetchProformaProcessRecords,
  generateProformasFromProcess,
} from '../../api/proformaProcess';
import { downloadPriorityErpExport } from '../../api/priorityErpExport';
import {
  fetchJobStenotypistCandidates,
  type JobStenotypistCandidate,
} from '../../api/jobs';
import { jobStatusLabelKey } from '../../config/job';
import { getPreviousMonthDateRange } from '../../config/jobReconciliation';
import {
  formatJobDurationHours,
  formatProformaProcessDate,
  formatProformaProcessLineTotal,
  parseProformaProcessError,
  proformaProcessTypeLabelKey,
} from '../../config/proformaProcess';
import { PROFORMA_PROCESS_ITEM_TYPES } from '../../types/proformaProcess';
import type { ProformaProcessGroup, ProformaProcessItemType } from '../../types/proformaProcess';
import type { JobStatus } from '../../types/job';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/financials.css';

const PROCESS_JOB_STATUSES: readonly JobStatus[] = ['published', 'reconciled'];

const defaultDateRange = getPreviousMonthDateRange();

type ProgressStep = 'idle' | 'validating' | 'generating' | 'complete' | 'error';

const PROGRESS_LABEL_KEYS = {
  validating: 'proformaProcessProgress_validating',
  generating: 'proformaProcessProgress_generating',
  complete: 'proformaProcessProgress_complete',
  error: 'proformaProcessProgress_error',
} as const;

export default function ProformaProcessTable() {
  const { t } = useLanguage();

  const [groups, setGroups] = useState<ProformaProcessGroup[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [stenotypists, setStenotypists] = useState<JobStenotypistCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [stenotypistUserId, setStenotypistUserId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
  const [jobStatus, setJobStatus] = useState<JobStatus | ''>('');
  const [type, setType] = useState<ProformaProcessItemType | ''>('');
  const [progressStep, setProgressStep] = useState<ProgressStep>('idle');
  const [generating, setGenerating] = useState(false);
  const [lastExportId, setLastExportId] = useState<string | null>(null);
  const [downloadingExport, setDownloadingExport] = useState(false);

  const filters = useMemo(
    () => ({
      customerId,
      stenotypistUserId,
      dateFrom,
      dateTo,
      jobStatus,
      type,
    }),
    [customerId, dateFrom, dateTo, jobStatus, stenotypistUserId, type],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchProformaProcessRecords(filters);
      setGroups(result.groups);
      setTotalItems(result.totalItems);
    } catch (err) {
      setError(parseProformaProcessError((err as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchJobStenotypistCandidates()])
      .then(([customerRows, stenotypistRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setStenotypists(stenotypistRows);
      })
      .catch(() => {
        if (active) setError(t('proformaProcessLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    setProgressStep('validating');

    try {
      setProgressStep('generating');
      const result = await generateProformasFromProcess(filters);
      setProgressStep('complete');
      setLastExportId(result.exportId);
      setSuccess(
        t('proformaProcessGenerateSuccess')
          .replace('{count}', String(result.proformas.length))
          .replace('{jobs}', String(result.jobsUpdated)),
      );
      await loadItems();
    } catch (err) {
      setProgressStep('error');
      setError(parseProformaProcessError((err as Error).message, t));
    } finally {
      setGenerating(false);
      window.setTimeout(() => setProgressStep('idle'), 2000);
    }
  };

  const handleDownloadExport = async (format: 'csv' | 'json') => {
    if (!lastExportId) return;
    setDownloadingExport(true);
    setError('');
    try {
      await downloadPriorityErpExport(lastExportId, format);
    } catch (err) {
      setError(parseProformaProcessError((err as Error).message, t));
    } finally {
      setDownloadingExport(false);
    }
  };

  const renderLineCell = (value: string) => value || '—';

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('proformas')}</h1>
          <p className="page-subtitle">{t('proformaProcessSubtitle')}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={generating || totalItems === 0}
          onClick={() => void handleGenerate()}
        >
          {generating ? t('proformaProcessGenerating') : t('proformaProcessGenerate')}
        </button>
      </div>

      <div className="financials-panel">
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {success ? <div className="profile-alert profile-alert-success">{success}</div> : null}
        {lastExportId ? (
          <div className="proforma-export-download">
            <span>{t('priorityErpExportReady')}</span>
            <button
              type="button"
              className="btn-secondary"
              disabled={downloadingExport}
              onClick={() => void handleDownloadExport('csv')}
            >
              {downloadingExport ? t('loading') : t('priorityErpExportDownloadCsv')}
            </button>
            <button
              type="button"
              className="btn-link"
              disabled={downloadingExport}
              onClick={() => void handleDownloadExport('json')}
            >
              {t('priorityErpExportDownloadJson')}
            </button>
          </div>
        ) : null}

        {progressStep !== 'idle' && progressStep in PROGRESS_LABEL_KEYS ? (
          <div className="proforma-process-progress" aria-live="polite">
            <div className="proforma-process-progress-bar" />
            <p>{t(PROGRESS_LABEL_KEYS[progressStep as keyof typeof PROGRESS_LABEL_KEYS])}</p>
          </div>
        ) : null}

        <div className="filters">
          <div className="filters-row">
            <label className="filter-select">
              <span>{t('dateFrom')}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label className="filter-select">
              <span>{t('dateTo')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            <label className="filter-select">
              <span>{t('customer')}</span>
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">{t('proformaProcessNoCustomerSelected')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('stenotypist')}</span>
              <select
                value={stenotypistUserId}
                onChange={(event) => setStenotypistUserId(event.target.value)}
              >
                <option value="">{t('allStenotypists')}</option>
                {stenotypists.map((stenotypist) => (
                  <option key={stenotypist.id} value={stenotypist.id}>
                    {stenotypist.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('status')}</span>
              <select
                value={jobStatus}
                onChange={(event) => setJobStatus(event.target.value as JobStatus | '')}
              >
                <option value="">{t('allStatuses')}</option>
                {PROCESS_JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(jobStatusLabelKey(status))}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>{t('proformaProcessType')}</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as ProformaProcessItemType | '')}
              >
                <option value="">{t('allTypes')}</option>
                {PROFORMA_PROCESS_ITEM_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(proformaProcessTypeLabelKey(value))}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <p>{t('loading')}</p>
        ) : groups.length === 0 ? (
          <p>{t('noRecordsFound')}</p>
        ) : (
          <div className="proforma-process-groups">
            {groups.map((group) => (
              <section key={group.customerId || group.customerName} className="proforma-process-group">
                <h2 className="proforma-process-group-title">{group.customerName}</h2>
                <div className="table-wrap proforma-process-table-wrap">
                  <table className="data-table proforma-process-table">
                    <thead>
                      <tr>
                        <th>{t('proformaProcessType')}</th>
                        <th>{t('jobNumber')}</th>
                        <th>{t('date')}</th>
                        <th>{t('status')}</th>
                        <th>{t('project')}</th>
                        <th>{t('stenotypistAlias')}</th>
                        <th>{t('receiptNumberFromAdministrator')}</th>
                        <th>{t('proformaProcessJobDuration')}</th>
                        <th>{t('proformaProcessHourlyRate')}</th>
                        <th>{t('district')}</th>
                        <th>{t('proformaProcessTravellingCharges')}</th>
                        <th>{t('proformaProcessLineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{t(proformaProcessTypeLabelKey(item.type))}</td>
                          <td>{item.jobNumber}</td>
                          <td>{formatProformaProcessDate(item.jobDate)}</td>
                          <td>{t(jobStatusLabelKey(item.jobStatus))}</td>
                          <td>{item.projectLabel}</td>
                          <td>{renderLineCell(item.stenotypistAlias)}</td>
                          <td>{renderLineCell(item.receiptNumber)}</td>
                          <td>
                            {item.type === 'stenotyping'
                              ? renderLineCell(formatJobDurationHours(item.jobDurationHours))
                              : '—'}
                          </td>
                          <td>
                            {item.type === 'stenotyping' && item.hourlyRate !== null
                              ? item.hourlyRate.toFixed(2)
                              : '—'}
                          </td>
                          <td>{item.districtLabel}</td>
                          <td>
                            {item.type === 'travelling' && item.travellingCharges !== null
                              ? formatProformaProcessLineTotal(item.travellingCharges)
                              : '—'}
                          </td>
                          <td>{formatProformaProcessLineTotal(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
