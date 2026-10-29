import { useEffect, useState } from 'react';

import { fetchTranscriptReport } from '../../api/transcripts';

import { formatTranscriptReportDeadline } from '../../config/transcriptDetails';

import type { TranscriptRecord, TranscriptReport } from '../../types/transcript';

import { useLanguage } from '../../i18n/LanguageContext';

import type { TranslationKey } from '../../i18n/translations';

import '../../styles/profile.css';



interface TranscriptReportDialogProps {

  transcript: TranscriptRecord;

  onClose: () => void;

}



function formatReportHours(

  value: number | null | undefined,

  t: (key: TranslationKey) => string,

): string {

  if (value === null || value === undefined) return '—';

  return t('transcriptReportHoursValue').replace('{hours}', String(value));

}



function formatReportRatio(

  value: number | null | undefined,

  suffixKey: TranslationKey,

  t: (key: TranslationKey) => string,

): string {

  if (value === null || value === undefined) return '—';

  return t('transcriptReportRatioValue')

    .replace('{value}', value.toFixed(2))

    .replace('{suffix}', t(suffixKey));

}



function formatAccuracy(value: number | null | undefined): string {

  if (value === null || value === undefined) return '—';

  return `${value.toFixed(2)}%`;

}



function formatPendingSummary(

  pending: TranscriptReport['pendingTranscripts'],

  t: (key: TranslationKey) => string,

): string {

  return t('transcriptReportPendingSummary')

    .replace('{total}', String(pending.total))

    .replace('{completed}', String(pending.completed))

    .replace('{edited}', String(pending.edited))

    .replace('{inReview}', String(pending.inReview))

    .replace('{approved}', String(pending.approved));

}



export default function TranscriptReportDialog({ transcript, onClose }: TranscriptReportDialogProps) {

  const { t } = useLanguage();

  const [report, setReport] = useState<TranscriptReport | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');



  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    setError('');

    fetchTranscriptReport(transcript.id)

      .then((data) => {

        if (!cancelled) setReport(data.report);

      })

      .catch(() => {

        if (!cancelled) setError(t('transcriptReportLoadError'));

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, [transcript.id, t]);



  const deadlineText =

    report?.showDeadline && report.deadlineMinutes !== null

      ? formatTranscriptReportDeadline(report.deadlineMinutes)

      : '—';

  const deadlineOverdue = (report?.deadlineMinutes ?? 0) < 0;



  return (

    <div className="dialog-overlay" role="presentation" onClick={onClose}>

      <div

        className="dialog-card dialog-card-wide"

        role="dialog"

        aria-modal="true"

        aria-labelledby="transcript-report-title"

        onClick={(event) => event.stopPropagation()}

      >

        <h2 id="transcript-report-title">

          {t('transcriptReportTitle').replace('{jobNumber}', transcript.jobNumber)}

        </h2>



        {loading ? (

          <p className="dialog-hint">{t('loading')}</p>

        ) : error ? (

          <div className="profile-alert profile-alert-error">{error}</div>

        ) : report ? (

          <div className="dialog-body transcript-detail-grid">

            <DetailField label={t('transcriptReportPages')} value={String(report.pages)} />

            <DetailField

              label={t('transcriptReportBilledStenotypingHours')}

              value={report.billedStenotypingLabel}

            />

            <DetailField

              label={t('transcriptReportEditingHours')}

              value={formatReportHours(report.editingHours, t)}

            />

            <DetailField

              label={t('transcriptReportEditingHoursPerPage')}

              value={formatReportRatio(

                report.editingHoursPerPage,

                'transcriptReportPerPage',

                t,

              )}

            />

            <DetailField

              label={t('transcriptReportEditingHoursPerBilledHour')}

              value={formatReportRatio(

                report.editingHoursPerBilledHour,

                'transcriptReportPerBilledHour',

                t,

              )}

            />

            <DetailField

              label={t('transcriptReportReviewingHours')}

              value={formatReportHours(report.reviewingHours, t)}

            />

            <DetailField

              label={t('transcriptReportReviewingHoursPerPage')}

              value={formatReportRatio(

                report.reviewingHoursPerPage,

                'transcriptReportPerPage',

                t,

              )}

            />

            <DetailField

              label={t('transcriptReportReviewingHoursPerBilledHour')}

              value={formatReportRatio(

                report.reviewingHoursPerBilledHour,

                'transcriptReportPerBilledHour',

                t,

              )}

            />

            <DetailField

              label={t('transcriptReportAccuracy')}

              value={formatAccuracy(report.accuracyPercent)}

            />

            {report.showDeadline ? (

              <div className="transcript-detail-field">

                <span className="transcript-detail-label">{t('deadline')}</span>

                <span

                  className={`transcript-detail-value${

                    deadlineOverdue ? ' transcript-report-deadline-overdue' : ''

                  }`}

                >

                  {deadlineText}

                </span>

              </div>

            ) : null}

            <DetailField

              label={t('transcriptReportMonthStenotypistBilled')}

              value={report.monthStenotypistBilledLabel}

            />

            <DetailField

              label={t('transcriptReportMonthPagesBilled')}

              value={report.monthPagesBilledLabel}

            />

            <DetailField

              label={t('transcriptReportPendingTranscripts')}

              value={formatPendingSummary(report.pendingTranscripts, t)}

              wide

            />

          </div>

        ) : null}



        <div className="dialog-actions">

          <button type="button" className="btn-secondary" onClick={onClose}>

            {t('close')}

          </button>

        </div>

      </div>

    </div>

  );

}



function DetailField({

  label,

  value,

  wide = false,

}: {

  label: string;

  value: string;

  wide?: boolean;

}) {

  return (

    <div className={`transcript-detail-field${wide ? ' transcript-detail-field-wide' : ''}`}>

      <span className="transcript-detail-label">{label}</span>

      <span className="transcript-detail-value">{value?.trim() ? value : '—'}</span>

    </div>

  );

}


