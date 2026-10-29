import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { fetchStenotypistInfoPanel } from '../../api/stenotypistInfoPanel';
import { MATRIX_METRIC_KEYS, type MatrixMetricKey } from '../../config/jobMatrix';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { StenotypistInfoPanelView, StenotypistInfoPeriod } from '../../types/stenotypistInfoPanel';
import '../../styles/job-allocation.css';

interface StenotypistInfoPanelProps {
  stenotypistUserId: string;
  centerDate: string;
  onClose: () => void;
}

const PERIOD_OPTIONS: StenotypistInfoPeriod[] = [
  'yesterday',
  'current_month',
  'last_30_days',
  'last_3_months',
  'last_6_months',
  'last_year',
];

const PERIOD_LABEL_KEYS: Record<StenotypistInfoPeriod, TranslationKey> = {
  yesterday: 'infoPeriodYesterday',
  current_month: 'infoPeriodCurrentMonth',
  last_30_days: 'infoPeriodLast30Days',
  last_3_months: 'infoPeriodLast3Months',
  last_6_months: 'infoPeriodLast6Months',
  last_year: 'infoPeriodLastYear',
};

const METRIC_LABEL_KEYS: Record<MatrixMetricKey, TranslationKey> = {
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

const DELAY_BUCKET_KEYS = [
  { key: 'under1', labelKey: 'infoDelayUnder1' as TranslationKey },
  { key: 'over1', labelKey: 'infoDelayOver1' as TranslationKey },
  { key: 'over2', labelKey: 'infoDelayOver2' as TranslationKey },
  { key: 'over4', labelKey: 'infoDelayOver4' as TranslationKey },
  { key: 'over8', labelKey: 'infoDelayOver8' as TranslationKey },
  { key: 'over24', labelKey: 'infoDelayOver24' as TranslationKey },
  { key: 'over48', labelKey: 'infoDelayOver48' as TranslationKey },
];

export default function StenotypistInfoPanel({
  stenotypistUserId,
  centerDate,
  onClose,
}: StenotypistInfoPanelProps) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<StenotypistInfoPeriod>('current_month');
  const [data, setData] = useState<StenotypistInfoPanelView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ x: 96, y: 72 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const panel = await fetchStenotypistInfoPanel(stenotypistUserId, { period, centerDate });
      setData(panel);
    } catch {
      setError(t('stenotypistInfoLoadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [stenotypistUserId, period, centerDate, t]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragState.current) return;
      setPosition({
        x: dragState.current.originX + event.clientX - dragState.current.startX,
        y: dragState.current.originY + event.clientY - dragState.current.startY,
      });
    };
    const handleMouseUp = () => {
      dragState.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  };

  return (
    <div
      className="stenotypist-info-overlay"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-labelledby="stenotypist-info-title"
      aria-modal="false"
    >
      <div className="stenotypist-info-panel-card">
        <header
          className="stenotypist-info-panel-header"
          onMouseDown={handleDragStart}
        >
          <h2 id="stenotypist-info-title">
            {t('stenotypistInfoPanelTitle').replace(
              '{alias}',
              data?.alias ?? stenotypistUserId,
            )}
          </h2>
          <button
            type="button"
            className="stenotypist-info-close-btn"
            onClick={onClose}
            aria-label={t('close')}
          >
            ×
          </button>
        </header>

        <div className="stenotypist-info-panel-body">
          {error ? <div className="stenotypist-info-error">{error}</div> : null}
          {loading ? (
            <p className="stenotypist-info-loading">{t('loading')}</p>
          ) : data ? (
            <>
              <InfoRow label={t('fullName')} value={data.fullName || '—'} />

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionMetrics')}</h3>
                <div className="stenotypist-info-metrics-grid">
                  {MATRIX_METRIC_KEYS.map((key) => (
                    <div key={key} className="stenotypist-info-metric">
                      <span className="stenotypist-info-metric-label">{t(METRIC_LABEL_KEYS[key])}</span>
                      <span
                        className={[
                          'stenotypist-info-metric-value',
                          key === 'm8' && data.metrics.m8Late ? 'metric-late' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {data.metrics[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionAssets')}</h3>
                <InfoRow label={t('laptopSerialNumber')} value={data.assets.laptopSerialNumber || '—'} />
                <InfoRow
                  label={t('stenotypeMachineSerialNumber')}
                  value={data.assets.stenotypeMachineSerialNumber || '—'}
                />
                <InfoRow label={t('eKeyNumber')} value={data.assets.eKeyNumber || '—'} />
                <InfoRow label={t('eKeyExpiryDate')} value={data.assets.eKeyExpiryDate || '—'} />
              </section>

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionBonus')}</h3>
                <InfoRow label={t('infoTotalBillableHours')} value={data.bonus.totalBillableHours} />
                <InfoRow label={t('infoBaseHours')} value={data.bonus.baseHours} />
                <InfoRow label={t('infoExtraHours')} value={data.bonus.extraHours} />
                <InfoRow label={t('infoBonusPerExtraHour')} value={data.bonus.bonusPerExtraHour} />
                <InfoRow label={t('infoBonusAmount')} value={data.bonus.bonus} />
              </section>

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionPersonalDictionary')}</h3>
                {data.personalDictionaryEntries.length === 0 ? (
                  <p className="stenotypist-info-empty">{t('infoNoPersonalDictionaryEntries')}</p>
                ) : (
                  <table className="stenotypist-info-table">
                    <thead>
                      <tr>
                        <th>{t('jobNumber')}</th>
                        <th>{t('date')}</th>
                        <th>{t('infoDictionaryLines')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.personalDictionaryEntries.map((entry) => (
                        <tr key={entry.jobId}>
                          <td>{entry.jobNumber}</td>
                          <td>{entry.date}</td>
                          <td>{entry.lines}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionLeave')}</h3>
                <InfoRow
                  label={t('infoLeaveDaysTakenYear')}
                  value={String(data.leave.daysTakenCurrentYear)}
                />
                <InfoRow
                  label={t('infoLeaveApprovedUpcoming')}
                  value={String(data.leave.approvedLeaveUpcomingDays)}
                />
              </section>

              <section className="stenotypist-info-section">
                <h3>{t('infoSectionPeriod')}</h3>
                <div className="stenotypist-info-period-buttons">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={period === option ? 'period-btn period-btn-active' : 'period-btn'}
                      onClick={() => setPeriod(option)}
                    >
                      {t(PERIOD_LABEL_KEYS[option])}
                    </button>
                  ))}
                </div>

                <InfoRow label={t('infoTravellingTime')} value={data.periodInfo.travellingTime} />
                <InfoRow
                  label={t('infoTravellingBilledRatio')}
                  value={data.periodInfo.travellingBilledHoursRatio}
                />
                <InfoRow
                  label={t('infoTotalPagesWritten')}
                  value={data.periodInfo.totalPagesWritten}
                />
                <InfoRow
                  label={t('infoPendingTranscriptPages')}
                  value={data.periodInfo.pendingTranscriptPages}
                />
                <InfoRow
                  label={t('infoTotalPagesPlusPending')}
                  value={data.periodInfo.totalPagesWrittenPlusPending}
                />
                <InfoRow
                  label={t('infoPagesWrittenBilledRatio')}
                  value={data.periodInfo.pagesWrittenBilledHoursRatio}
                />
                <InfoRow label={t('infoDaysOut')} value={String(data.periodInfo.daysOut)} />
                <InfoRow label={t('infoLastDateOut')} value={data.periodInfo.lastDateOut} />
                <InfoRow
                  label={t('infoDelayedTranscripts')}
                  value={String(data.periodInfo.delayedTranscriptCount)}
                />

                <div className="stenotypist-info-delay-table-wrap">
                  <table className="stenotypist-info-delay-table">
                    <thead>
                      <tr>
                        {DELAY_BUCKET_KEYS.map((bucket) => (
                          <th key={bucket.key}>{t(bucket.labelKey)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {DELAY_BUCKET_KEYS.map((bucket) => (
                          <td key={bucket.key}>
                            {data.periodInfo.delayedTranscriptBuckets[bucket.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stenotypist-info-row">
      <span className="stenotypist-info-label">{label}</span>
      <span className="stenotypist-info-value">{value}</span>
    </div>
  );
}
