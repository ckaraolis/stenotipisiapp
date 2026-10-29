import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { fetchJobReconciliationRecord, updateJobReconciliation } from '../../api/jobReconciliation';
import { travellingChargesLabelKey } from '../../config/customer';
import {
  formatJobReconciliationDate,
  formatJobReconciliationProjectLabel,
  formatJobTravellingChargeAmount,
  isBillableTravellingChargesMode,
  parseJobReconciliationError,
  resolveTravellingChargesSystemAmount,
} from '../../config/jobReconciliation';
import {
  formatTravellingChargeAmountInput,
  normalizeTravellingChargeAmountInput,
} from '../../config/travellingCharges';
import type { JobRecord } from '../../types/jobRecord';
import { useLanguage } from '../../i18n/LanguageContext';
import TimeDigitsInput from '../scheduling/jobSubmission/TimeDigitsInput';
import '../../styles/profile.css';
import '../../styles/financials.css';

interface JobReconciliationFormProps {
  jobId: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

interface AdministratorFormState {
  receiptNumberAdministrator: string;
  startTimeAdministrator: string;
  endTimeAdministrator: string;
  travellingChargesAdministrator: string;
  travellingKm: string;
  travellingKmRate: string;
}

function FieldPairRow({
  label,
  stenotypistValue,
  children,
  acceptLabel,
  onAccept,
}: {
  label: string;
  stenotypistValue: string;
  children: ReactNode;
  acceptLabel: string;
  onAccept: () => void;
}) {
  return (
    <>
      <span className="profile-label">{label}</span>
      <div className="job-reconciliation-pair">
        <div className="job-reconciliation-readonly">{stenotypistValue || '—'}</div>
        <div className="job-reconciliation-admin-field">{children}</div>
        <button type="button" className="btn-secondary job-reconciliation-accept-btn" onClick={onAccept}>
          {acceptLabel}
        </button>
      </div>
    </>
  );
}

export default function JobReconciliationForm({
  jobId,
  onCancel,
  onSaved,
}: JobReconciliationFormProps) {
  const { t } = useLanguage();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<AdministratorFormState>({
    receiptNumberAdministrator: '',
    startTimeAdministrator: '',
    endTimeAdministrator: '',
    travellingChargesAdministrator: '',
    travellingKm: '',
    travellingKmRate: '',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchJobReconciliationRecord(jobId)
      .then((record) => {
        if (!active) return;
        setJob(record);
        setForm({
          receiptNumberAdministrator: record.receiptNumberAdministrator,
          startTimeAdministrator: record.startTimeAdministrator,
          endTimeAdministrator: record.endTimeAdministrator,
          travellingChargesAdministrator: formatTravellingChargeAmountInput(
            record.travellingChargesAdministrator || record.travellingChargesSystem,
          ),
          travellingKm:
            record.travellingKm > 0 ? formatTravellingChargeAmountInput(record.travellingKm) : '',
          travellingKmRate:
            record.travellingKmRate > 0
              ? formatTravellingChargeAmountInput(record.travellingKmRate)
              : '',
        });
      })
      .catch(() => {
        if (active) setError(t('jobReconciliationLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId, t]);

  const travellingChargesSystem = useMemo(() => {
    if (!job) return 0;
    return resolveTravellingChargesSystemAmount(
      job.projectTravellingCharges,
      job.travellingChargesSystem,
      form.travellingKm,
      form.travellingKmRate,
    );
  }, [form.travellingKm, form.travellingKmRate, job]);

  const updateField = (field: keyof AdministratorFormState, value: string) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const acceptReceiptNumber = () => {
    if (!job) return;
    updateField('receiptNumberAdministrator', job.receiptNumberStenotypist);
  };

  const acceptStartTime = () => {
    if (!job) return;
    updateField('startTimeAdministrator', job.startTimeStenotypist);
  };

  const acceptEndTime = () => {
    if (!job) return;
    updateField('endTimeAdministrator', job.endTimeStenotypist);
  };

  const acceptTravelling = () => {
    updateField(
      'travellingChargesAdministrator',
      formatTravellingChargeAmountInput(travellingChargesSystem),
    );
  };

  const acceptAll = () => {
    if (!job) return;
    setError('');
    setForm((current) => ({
      ...current,
      receiptNumberAdministrator: job.receiptNumberStenotypist,
      startTimeAdministrator: job.startTimeStenotypist,
      endTimeAdministrator: job.endTimeStenotypist,
      travellingChargesAdministrator: formatTravellingChargeAmountInput(travellingChargesSystem),
    }));
  };

  const validateForm = (): string | null => {
    if (!job) return t('jobReconciliationLoadError');
    if (!form.receiptNumberAdministrator.trim()) return t('jobReceiptNumberAdministratorRequired');
    if (!form.startTimeAdministrator.trim()) return t('jobStartTimeAdministratorRequired');
    if (!form.endTimeAdministrator.trim()) return t('jobEndTimeAdministratorRequired');

    if (form.startTimeAdministrator >= form.endTimeAdministrator) {
      return t('jobAdministratorTimeRangeInvalid');
    }

    if (job.projectTravellingCharges === 'billable_by_km') {
      if (!form.travellingKm.trim()) return t('jobTravellingKmRequired');
      if (!form.travellingKmRate.trim()) return t('jobTravellingKmRateRequired');
    }

    const travellingChargesAdministrator = normalizeTravellingChargeAmountInput(
      form.travellingChargesAdministrator,
    );
    if (travellingChargesAdministrator === null) {
      return t('travellingChargeAmountInvalid');
    }

    if (
      isBillableTravellingChargesMode(job.projectTravellingCharges) &&
      travellingChargesAdministrator <= 0
    ) {
      return t('jobTravellingChargesAdministratorRequired');
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!job) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const travellingChargesAdministrator = normalizeTravellingChargeAmountInput(
      form.travellingChargesAdministrator,
    );
    if (travellingChargesAdministrator === null) {
      setError(t('travellingChargeAmountInvalid'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateJobReconciliation(jobId, {
        receiptNumberAdministrator: form.receiptNumberAdministrator,
        startTimeAdministrator: form.startTimeAdministrator,
        endTimeAdministrator: form.endTimeAdministrator,
        travellingChargesAdministrator,
        travellingKm:
          job.projectTravellingCharges === 'billable_by_km'
            ? normalizeTravellingChargeAmountInput(form.travellingKm) ?? 0
            : 0,
        travellingKmRate:
          job.projectTravellingCharges === 'billable_by_km'
            ? normalizeTravellingChargeAmountInput(form.travellingKmRate) ?? 0
            : 0,
      });
      onSaved(t('jobReconciliationSavedSuccess'));
    } catch (err) {
      setError(parseJobReconciliationError((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="financials-page">{t('loading')}</div>;
  }

  if (!job) {
    return (
      <div className="financials-page">
        <div className="profile-alert profile-alert-error">{error || t('jobReconciliationLoadError')}</div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    );
  }

  const travellingChargesLabel = t(travellingChargesLabelKey(job.projectTravellingCharges));

  return (
    <div className="financials-page">
      <div className="page-header financials-header">
        <div>
          <h1 className="page-title">{t('jobReconciliationFormTitle')}</h1>
          <p className="page-subtitle">{t('jobReconciliationFormSubtitle')}</p>
        </div>
      </div>

      <form className="profile-form financials-panel job-reconciliation-form" onSubmit={handleSubmit}>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

        <div className="profile-grid">
          <span className="profile-label">{t('jobNumber')}</span>
          <span>{job.jobNumber}</span>

          <span className="profile-label">{t('customerAlias')}</span>
          <span>{job.customerAlias || '—'}</span>

          <span className="profile-label">{t('project')}</span>
          <span>{formatJobReconciliationProjectLabel(job)}</span>

          <span className="profile-label">{t('date')}</span>
          <span>{formatJobReconciliationDate(job.date)}</span>

          <span className="profile-label">{t('stenotypistAlias')}</span>
          <span>{job.stenotypistAlias || '—'}</span>
        </div>

        <div className="profile-grid job-reconciliation-grid">
          <FieldPairRow
            label={t('receiptNumberFromStenotypist')}
            stenotypistValue={job.receiptNumberStenotypist}
            acceptLabel={t('jobReconciliationAcceptReceiptNumber')}
            onAccept={acceptReceiptNumber}
          >
            <input
              id="receipt-number-administrator"
              type="text"
              className="profile-input"
              inputMode="numeric"
              maxLength={5}
              value={form.receiptNumberAdministrator}
              onChange={(event) =>
                updateField(
                  'receiptNumberAdministrator',
                  event.target.value.replace(/\D/g, '').slice(0, 5),
                )
              }
              onBlur={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 5);
                if (digits) {
                  updateField('receiptNumberAdministrator', digits.padStart(5, '0'));
                }
              }}
            />
          </FieldPairRow>

          <FieldPairRow
            label={t('startTimeFromStenotypist')}
            stenotypistValue={job.startTimeStenotypist}
            acceptLabel={t('jobReconciliationAcceptStartTime')}
            onAccept={acceptStartTime}
          >
            <TimeDigitsInput
              id="start-time-administrator"
              label=""
              hideLabel
              value={form.startTimeAdministrator}
              onChange={(value) => updateField('startTimeAdministrator', value)}
            />
          </FieldPairRow>

          <FieldPairRow
            label={t('endTimeFromStenotypist')}
            stenotypistValue={job.endTimeStenotypist}
            acceptLabel={t('jobReconciliationAcceptEndTime')}
            onAccept={acceptEndTime}
          >
            <TimeDigitsInput
              id="end-time-administrator"
              label=""
              hideLabel
              value={form.endTimeAdministrator}
              onChange={(value) => updateField('endTimeAdministrator', value)}
            />
          </FieldPairRow>

          <span className="profile-label">{t('travellingCharges')}</span>
          <span>{travellingChargesLabel}</span>

          {job.projectTravellingCharges === 'billable_by_km' ? (
            <>
              <label className="profile-label" htmlFor="travelling-km">
                {t('jobTravellingKm')}
              </label>
              <input
                id="travelling-km"
                type="text"
                className="profile-input"
                inputMode="decimal"
                value={form.travellingKm}
                onChange={(event) => updateField('travellingKm', event.target.value)}
              />

              <label className="profile-label" htmlFor="travelling-km-rate">
                {t('jobTravellingKmRate')}
              </label>
              <input
                id="travelling-km-rate"
                type="text"
                className="profile-input"
                inputMode="decimal"
                value={form.travellingKmRate}
                onChange={(event) => updateField('travellingKmRate', event.target.value)}
              />
            </>
          ) : null}

          <span className="profile-label">{t('travellingChargesSystem')}</span>
          <span>{formatJobTravellingChargeAmount(travellingChargesSystem)}</span>

          <span className="profile-label">{t('travellingChargesAdministrator')}</span>
          <div className="job-reconciliation-pair">
            <div className="job-reconciliation-admin-field">
              <input
                id="travelling-charges-administrator"
                type="text"
                className="profile-input"
                inputMode="decimal"
                value={form.travellingChargesAdministrator}
                onChange={(event) =>
                  updateField('travellingChargesAdministrator', event.target.value)
                }
              />
            </div>
            <button
              type="button"
              className="btn-secondary job-reconciliation-accept-btn"
              onClick={acceptTravelling}
            >
              {t('jobReconciliationAcceptTravelling')}
            </button>
          </div>
        </div>

        <div className="profile-actions job-reconciliation-actions">
          <button type="button" className="btn-secondary" onClick={acceptAll} disabled={saving}>
            {t('jobReconciliationAcceptAll')}
          </button>
          <div className="job-reconciliation-primary-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
