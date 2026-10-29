import { useCallback, useEffect, useState } from 'react';
import { fetchTranscriptsAnalysisReport } from '../../api/transcripts';
import { jobStatusLabelKey } from '../../config/job';
import { downloadTranscriptsAnalysisCsv } from '../../config/transcriptAnalysisReport';
import { formatTranscriptJobStatus } from '../../config/transcriptDetails';
import { formatTranscriptEte } from '../../config/transcriptListDisplay';
import type {
  TranscriptAnalysisFilterOptions,
  TranscriptAnalysisRow,
} from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/dashboard.css';
import '../../styles/profile.css';

function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(2);
}

function formatAccuracy(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}

export default function TranscriptsAnalysisReportTable() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<TranscriptAnalysisRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<TranscriptAnalysisFilterOptions>({
    customers: [],
    statuses: [],
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTranscriptsAnalysisReport({
        dateFrom,
        dateTo,
        customerId,
        jobStatus,
        search,
      });
      setRows(data.rows);
      setTotal(data.total);
      setFilterOptions(data.filterOptions);
    } catch {
      setRows([]);
      setTotal(0);
      setError(t('transcriptsAnalysisReportLoadError'));
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFrom, dateTo, jobStatus, search, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTranscriptsAnalysisCsv(rows, `transcripts-analysis-report-${stamp}.csv`);
  };

  return (
    <div className="transcripts-panel">
      <div className="transcripts-toolbar">
        <div className="transcripts-filters">
          <label className="filter-field">
            <span className="sr-only">{t('search')}</span>
            <input
              type="search"
              className="filter-input"
              placeholder={t('search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">{t('dateFrom')}</span>
            <input
              type="date"
              className="filter-input"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">{t('dateTo')}</span>
            <input
              type="date"
              className="filter-input"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">{t('customer')}</span>
            <select
              className="filter-input"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">{t('allCustomers')}</option>
              {filterOptions.customers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span className="sr-only">{t('status')}</span>
            <select
              className="filter-input"
              value={jobStatus}
              onChange={(event) => setJobStatus(event.target.value)}
            >
              <option value="">{t('allStatuses')}</option>
              {filterOptions.statuses.map((option) => (
                <option key={option} value={option}>
                  {t(jobStatusLabelKey(option))}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="transcripts-toolbar-actions">
          <button type="button" className="btn-secondary" onClick={() => void loadReport()} disabled={loading}>
            {loading ? t('loading') : t('refresh')}
          </button>
          <button type="button" className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>
            {t('transcriptsAnalysisReportExport')}
          </button>
        </div>
      </div>

      <p className="profile-field-hint">{t('transcriptsAnalysisReportHint')}</p>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

      <div className="table-wrapper transcripts-table-scroll">
        <table className="transcripts-table transcripts-analysis-table">
          <thead>
            <tr>
              <th>{t('jobNumber')}</th>
              <th>{t('status')}</th>
              <th>{t('customer')}</th>
              <th>{t('project')}</th>
              <th>{t('date')}</th>
              <th>{t('stenotypist')}</th>
              <th>{t('editor')}</th>
              <th>{t('reviewer')}</th>
              <th>{t('publisher')}</th>
              <th>{t('expedite')}</th>
              <th>{t('bypassApproval')}</th>
              <th>{t('jobEndTime')}</th>
              <th>{t('serviceLevelAgreement')}</th>
              <th>{t('deadline')}</th>
              <th>{t('ete')}</th>
              <th>{t('editDuration')}</th>
              <th>{t('transcriptOwners')}</th>
              <th>{t('transcriptReportPages')}</th>
              <th>{t('transcriptReportBilledStenotypingHours')}</th>
              <th>{t('transcriptReportEditingHours')}</th>
              <th>{t('transcriptReportEditingHoursPerPage')}</th>
              <th>{t('transcriptReportEditingHoursPerBilledHour')}</th>
              <th>{t('transcriptReportReviewingHours')}</th>
              <th>{t('transcriptReportReviewingHoursPerPage')}</th>
              <th>{t('transcriptReportReviewingHoursPerBilledHour')}</th>
              <th>{t('transcriptReportAccuracy')}</th>
              <th>{t('transcriptReportMonthStenotypistBilled')}</th>
              <th>{t('transcriptReportMonthPagesBilled')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={27} className="empty-row">
                  {t('loading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={27} className="empty-row">
                  {t('noTranscriptsFound')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.transcriptId}>
                  <td>{row.jobNumber}</td>
                  <td>
                    <span className={`status-badge status-${row.jobStatus}`}>
                      {formatTranscriptJobStatus(row.jobStatus, t)}
                    </span>
                  </td>
                  <td>{row.customerName || '—'}</td>
                  <td className="project-cell">{row.projectNumber || '—'}</td>
                  <td>{row.date}</td>
                  <td>{row.stenotypistAlias || row.stenotypistName || '—'}</td>
                  <td>{row.editorName || '—'}</td>
                  <td>{row.reviewerName || '—'}</td>
                  <td>{row.publisherName || '—'}</td>
                  <td className="center">{row.expedite ? '✓' : ''}</td>
                  <td className="center">{row.bypassApproval ? '✓' : ''}</td>
                  <td>{row.jobEndTime || '—'}</td>
                  <td>{row.serviceLevelAgreement || '—'}</td>
                  <td>{row.deadlineLabel || '—'}</td>
                  <td>{formatTranscriptEte(row.pages)}</td>
                  <td>{row.editDurationLabel || '—'}</td>
                  <td>{row.transcriptOwners || '—'}</td>
                  <td>{row.pages}</td>
                  <td>{row.billedStenotypingLabel}</td>
                  <td>{row.editingHours.toFixed(2)}</td>
                  <td>{formatRatio(row.editingHoursPerPage)}</td>
                  <td>{formatRatio(row.editingHoursPerBilledHour)}</td>
                  <td>{row.reviewingHours.toFixed(2)}</td>
                  <td>{formatRatio(row.reviewingHoursPerPage)}</td>
                  <td>{formatRatio(row.reviewingHoursPerBilledHour)}</td>
                  <td>{formatAccuracy(row.accuracyPercent)}</td>
                  <td>{row.monthStenotypistBilledLabel}</td>
                  <td>{row.monthPagesBilledLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-pagination financials-pagination">
        <span className="pagination-summary">
          {t('transcriptsAnalysisReportTotal').replace('{total}', String(total))}
        </span>
      </div>
    </div>
  );
}
