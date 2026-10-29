import { useEffect, useMemo, useState } from 'react';
import {
  completeJobSubmission,
  fetchJobById,
  fetchJobSubmission,
  saveJobSubmission,
} from '../../api/jobs';
import WorkflowWizard from '../common/WorkflowWizard';
import JobSubmissionWorkflowHeader from './JobSubmissionWorkflowHeader';
import RawFilesUploadForm from './jobSubmission/RawFilesUploadForm';
import AttachmentFilesUploadForm from './jobSubmission/AttachmentFilesUploadForm';
import OtherFilesUploadForm from './jobSubmission/OtherFilesUploadForm';
import SameDayActionsForm from './jobSubmission/SameDayActionsForm';
import JobReceiptForm from './jobSubmission/JobReceiptForm';
import FinalValidationForm from './jobSubmission/FinalValidationForm';
import {
  validateRawFilesBundle,
  buildJobSubmissionAnalysis,
} from '../../config/jobSubmissionRawFiles';
import {
  validateAttachmentFilesBundle,
} from '../../config/jobSubmissionAttachmentFiles';
import { validateJobSubmissionReceipt } from '../../config/jobSubmissionReceipt';
import { validateJobSubmissionSameDayActions } from '../../config/jobSubmissionSameDayActions';
import {
  getJobSubmissionStepId,
  getJobSubmissionStepIndex,
  JOB_SUBMISSION_STEP_OPTIONS,
  jobSubmissionStepLabelKey,
} from '../../config/jobSubmission';
import type {
  JobSubmissionAttachmentFilesBundle,
  JobSubmissionOtherFileEntry,
  JobSubmissionRawFilesBundle,
  JobSubmissionRecord,
  JobSubmissionStepId,
} from '../../types/jobSubmission';
import type { JobRecord } from '../../types/jobRecord';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface JobSubmissionWorkflowProps {
  jobId: string;
  onCancel: () => void;
  onCompleted: (message: string) => void;
}

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('jobSubmissionSaveError');
}

export default function JobSubmissionWorkflow({
  jobId,
  onCancel,
  onCompleted,
}: JobSubmissionWorkflowProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobRecord | null>(null);
  const [submission, setSubmission] = useState<JobSubmissionRecord | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rawFilesError, setRawFilesError] = useState('');
  const [attachmentFilesError, setAttachmentFilesError] = useState('');
  const [sameDayActionsError, setSameDayActionsError] = useState('');
  const [jobReceiptError, setJobReceiptError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([fetchJobById(jobId), fetchJobSubmission(jobId)])
      .then(([jobRecord, submissionRecord]) => {
        if (!active) return;
        setJob(jobRecord);
        setSubmission(submissionRecord);
        setStepIndex(getJobSubmissionStepIndex(submissionRecord.currentStep));
      })
      .catch((err) => {
        if (!active) return;
        setError(parseApiErrors((err as Error).message, t));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jobId, t]);

  const steps = useMemo(
    () =>
      JOB_SUBMISSION_STEP_OPTIONS.map((stepId) => ({
        id: stepId,
        label: t(jobSubmissionStepLabelKey(stepId)),
      })),
    [t],
  );

  const currentStepId = getJobSubmissionStepId(stepIndex);

  const completedStepIndexes = useMemo(() => {
    const indexes: number[] = [];
    for (let index = 0; index < stepIndex; index += 1) {
      indexes.push(index);
    }
    return indexes;
  }, [stepIndex]);

  const persistSubmission = async (nextStepId: JobSubmissionStepId, finish = false) => {
    if (!submission) return;
    setSaving(true);
    setError('');
    try {
      const analysis = buildJobSubmissionAnalysis(submission.rawFiles);
      const payload = {
        ...submission,
        ...analysis,
        currentStep: nextStepId,
      };
      if (finish) {
        await completeJobSubmission(jobId, payload);
        onCompleted(t('jobSubmissionTranscriptCreated'));
      } else {
        const saved = await saveJobSubmission(jobId, payload);
        setSubmission(saved);
        setStepIndex(getJobSubmissionStepIndex(nextStepId));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStepId === 'final_validation') {
      setStepIndex(getJobSubmissionStepIndex('job_receipt'));
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const validateCurrentStep = (): string => {
    if (!submission || !job) return '';

    if (currentStepId === 'raw_files') {
      const validationErrors = validateRawFilesBundle(job.jobNumber, submission.rawFiles);
      if (validationErrors.length > 0) {
        setRawFilesError(validationErrors.map((key) => t(key as TranslationKey)).join(' '));
        return validationErrors[0];
      }
      setRawFilesError('');
    }

    if (currentStepId === 'attachment_files') {
      const validationErrors = validateAttachmentFilesBundle(
        job.jobNumber,
        submission.attachmentFiles,
      );
      if (validationErrors.length > 0) {
        setAttachmentFilesError(
          validationErrors.map((key) => t(key as TranslationKey)).join(' '),
        );
        return validationErrors[0];
      }
      setAttachmentFilesError('');
    }

    if (currentStepId === 'same_day_actions') {
      const validationErrors = validateJobSubmissionSameDayActions(submission.sameDayActions);
      if (validationErrors.length > 0) {
        setSameDayActionsError(t(validationErrors[0]));
        return validationErrors[0];
      }
      setSameDayActionsError('');
    }

    if (currentStepId === 'job_receipt') {
      const validationErrors = validateJobSubmissionReceipt(submission.receipt);
      if (validationErrors.length > 0) {
        setJobReceiptError(t(validationErrors[0]));
        return validationErrors[0];
      }
      setJobReceiptError('');
    }

    return '';
  };

  const validateEntireSubmission = (): string => {
    if (!submission || !job) return t('jobSubmissionSaveError');

    const rawFileErrors = validateRawFilesBundle(job.jobNumber, submission.rawFiles);
    if (rawFileErrors.length > 0) {
      return rawFileErrors.map((key) => t(key as TranslationKey)).join(' ');
    }

    const attachmentFileErrors = validateAttachmentFilesBundle(
      job.jobNumber,
      submission.attachmentFiles,
    );
    if (attachmentFileErrors.length > 0) {
      return attachmentFileErrors.map((key) => t(key as TranslationKey)).join(' ');
    }

    const sameDayErrors = validateJobSubmissionSameDayActions(submission.sameDayActions);
    if (sameDayErrors.length > 0) {
      return sameDayErrors.map((key) => t(key)).join(' ');
    }

    const receiptErrors = validateJobSubmissionReceipt(submission.receipt);
    if (receiptErrors.length > 0) {
      return receiptErrors.map((key) => t(key)).join(' ');
    }

    return '';
  };

  const handleNext = () => {
    if (!submission || !job) return;
    if (validateCurrentStep()) return;

    const nextStepId = getJobSubmissionStepId(stepIndex + 1);
    void persistSubmission(nextStepId);
  };

  const handleFinish = () => {
    const validationError = validateEntireSubmission();
    if (validationError) {
      setError(validationError);
      return;
    }
    void persistSubmission('final_validation', true);
  };

  const updateRawFiles = (rawFiles: JobSubmissionRawFilesBundle) => {
    setSubmission((current) => (current ? { ...current, rawFiles } : current));
  };

  const updateAttachmentFiles = (attachmentFiles: JobSubmissionAttachmentFilesBundle) => {
    setSubmission((current) => (current ? { ...current, attachmentFiles } : current));
  };

  const updateOtherFiles = (otherFiles: JobSubmissionOtherFileEntry[]) => {
    setSubmission((current) => (current ? { ...current, otherFiles } : current));
  };

  const updateReceipt = (receipt: JobSubmissionRecord['receipt']) => {
    setSubmission((current) => (current ? { ...current, receipt } : current));
    setJobReceiptError('');
  };

  const updateSameDayActions = (sameDayActions: JobSubmissionRecord['sameDayActions']) => {
    setSubmission((current) =>
      current
        ? {
            ...current,
            sameDayActions,
          }
        : current,
    );
    setSameDayActionsError('');
  };

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  if (!job || !submission) {
    return (
      <div className="profile-alert profile-alert-error">
        {error || t('jobLoadError')}
      </div>
    );
  }

  return (
    <WorkflowWizard
      title={t('jobSubmissionWorkflowTitle')}
      steps={steps}
      currentStepIndex={stepIndex}
      completedStepIndexes={completedStepIndexes}
      header={<JobSubmissionWorkflowHeader job={job} />}
      error={error}
      saving={saving}
      onCancel={onCancel}
      onBack={handleBack}
      onNext={handleNext}
      onFinish={handleFinish}
    >
      {currentStepId === 'raw_files' && (
        <RawFilesUploadForm
          jobNumber={job.jobNumber}
          rawFiles={submission.rawFiles}
          onChange={updateRawFiles}
          error={rawFilesError}
          onError={setRawFilesError}
        />
      )}

      {currentStepId === 'attachment_files' && (
        <AttachmentFilesUploadForm
          jobNumber={job.jobNumber}
          attachmentFiles={submission.attachmentFiles}
          onChange={updateAttachmentFiles}
          error={attachmentFilesError}
          onError={setAttachmentFilesError}
        />
      )}

      {currentStepId === 'other_files' && (
        <OtherFilesUploadForm otherFiles={submission.otherFiles} onChange={updateOtherFiles} />
      )}

      {currentStepId === 'same_day_actions' && (
        <SameDayActionsForm
          sameDayActions={submission.sameDayActions}
          onChange={updateSameDayActions}
          error={sameDayActionsError}
          onError={setSameDayActionsError}
        />
      )}

      {currentStepId === 'job_receipt' && (
        <JobReceiptForm
          receipt={submission.receipt}
          onChange={updateReceipt}
          error={jobReceiptError}
          onError={setJobReceiptError}
        />
      )}

      {currentStepId === 'final_validation' && (
        <FinalValidationForm job={job} submission={submission} />
      )}
    </WorkflowWizard>
  );
}
