import { useCallback, useEffect, useState } from 'react';
import { fetchStenotypistSummaryReport } from '../../api/stenotypistSummaryReport';
import { fetchPublicHolidayRecords } from '../../api/publicHolidays';
import {
  MATRIX_METRIC_KEYS,
  type MatrixMetricKey,
} from '../../config/jobMatrix';
import {
  formatAllocationDateKey,
  formatDisplayDate,
  mockMatrixPublicHolidayDates,
} from '../../data/mockJobAllocation';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { JobMatrixMetrics } from '../../types/jobMatrix';
import type { StenotypistSummaryReportRow } from '../../types/stenotypistSummaryReport';
import {
  buildHolidayDateSet,
  getNextWorkingDay,
  shiftMatrixCenterDay,
} from '../../utils/jobMatrixDates';
import '../../styles/scheduling-reports.css';
import '../../styles/job-allocation.css';

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

const metricDescriptionKeys: Record<MatrixMetricKey, TranslationKey> = {
  m1: 'reportMetricM1Desc',
  m2: 'reportMetricM2Desc',
  m3: 'reportMetricM3Desc',
  m4: 'reportMetricM4Desc',
  m5: 'reportMetricM5Desc',
  m6: 'reportMetricM6Desc',
  m7: 'reportMetricM7Desc',
  m8: 'reportMetricM8Desc',
  m9: 'reportMetricM9Desc',
};

export default function StenotypistSummaryReportTable() {
  const { t } = useLanguage();
  const [centerDate, setCenterDate] = useState(() =>
    getNextWorkingDay(new Date(), mockMatrixPublicHolidayDates),
  );
  const [rows, setRows] = useState<StenotypistSummaryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const centerDateKey = formatAllocationDateKey(centerDate);

  useEffect(() => {
    void fetchPublicHolidayRecords()
      .then((records) => {
        const dates = buildHolidayDateSet(records, mockMatrixPublicHolidayDates);
        setCenterDate(getNextWorkingDay(new Date(), dates));
      })
      .catch(() => {
        setCenterDate(getNextWorkingDay(new Date(), mockMatrixPublicHolidayDates));
      });
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStenotypistSummaryReport(centerDateKey);
      setRows(data.rows);
    } catch {
      setRows([]);
      setError(t('stenotypistSummaryLoadError'));
    } finally {
      setLoading(false);
    }
  }, [centerDateKey, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const moveDay = (delta: number) => {
    setCenterDate((current) => shiftMatrixCenterDay(current, delta));
  };

  return (
    <section className="stenotypist-summary-report" aria-label={t('stenotypistSummaryReport')}>
      <div className="report-toolbar">
        <section className="report-date-selection" aria-label={t('reportReferenceDate')}>
          <button type="button" className="date-nav-btn" onClick={() => moveDay(-1)} title={t('previous')}>
            &lt;&lt;
          </button>
          <label className="report-date-label">
            <span className="sr-only">{t('reportReferenceDate')}</span>
            <input
              type="date"
              className="report-date-input"
              value={centerDateKey}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                setCenterDate(new Date(`${next}T12:00:00`));
              }}
            />
          </label>
          <button type="button" className="date-nav-btn" onClick={() => moveDay(1)} title={t('next')}>
            &gt;&gt;
          </button>
        </section>
        <p className="report-reference-note">
          {t('reportAsOfDate').replace('{date}', formatDisplayDate(centerDate))}
        </p>
      </div>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

      <div className="report-table-wrap">
        <table className="allocation-table stenotypist-summary-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-st">
                {t('st')}
              </th>
              <th rowSpan={2} className="col-full-name">
                {t('fullName')}
              </th>
              {MATRIX_METRIC_KEYS.map((key, index) => (
                <th
                  key={key}
                  rowSpan={2}
                  className={`metric-col${index === MATRIX_METRIC_KEYS.length - 1 ? ' col-metric-boundary' : ''}`}
                  title={t(metricDescriptionKeys[key])}
                >
                  {t(metricLabelKeys[key])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="metric-description-row">
              <td colSpan={2 + MATRIX_METRIC_KEYS.length}>
                <div className="metric-description-grid">
                  {MATRIX_METRIC_KEYS.map((key) => (
                    <span key={key} className="metric-description-item">
                      <strong>{t(metricLabelKeys[key])}:</strong> {t(metricDescriptionKeys[key])}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2 + MATRIX_METRIC_KEYS.length} className="empty-row">
                  {loading ? t('loading') : t('stenotypistSummaryEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="col-st staff-code">{row.alias}</td>
                  <td className="col-full-name">{row.fullName || '—'}</td>
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
