import { useMemo, useState } from 'react';
import { submitReviewedTranscriptWorkflow } from '../../api/transcripts';
import WorkflowWizard from '../common/WorkflowWizard';
import {
  getReviewedTranscriptStepId,
  REVIEWED_TRANSCRIPT_WORKFLOW_STEPS,
  reviewedTranscriptStepLabelKey,
  validateReviewedTranscriptFileName,
} from '../../config/reviewedTranscriptWorkflow';
import { readFileAsBase64 } from '../../config/transcriptFiles';
import type { TranscriptRecord } from '../../types/transcript';
import { getAuthUser } from '../../utils/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import ReviewedTranscriptFinalValidationForm from './reviewedTranscript/ReviewedTranscriptFinalValidationForm';
import ReviewedTranscriptUploadForm from './reviewedTranscript/ReviewedTranscriptUploadForm';
import SubmitReviewedTranscriptWorkflowHeader from './reviewedTranscript/SubmitReviewedTranscriptWorkflowHeader';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface SubmitReviewedTranscriptWorkflowProps {
  transcript: TranscriptRecord;
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
  return t('transcriptWorkflowSaveError');
}

function resolveReviewerName(transcript: TranscriptRecord): string {
  const authUser = getAuthUser();
  if (authUser?.fullName?.trim()) return authUser.fullName.trim();
  if (authUser?.username?.trim()) return authUser.username.trim();
  if (transcript.reviewerName?.trim()) return transcript.reviewerName.trim();
  return '';
}

export default function SubmitReviewedTranscriptWorkflow({
  transcript,
  onCancel,
  onCompleted,
}: SubmitReviewedTranscriptWorkflowProps) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState(transcript.reviewerRemarks ?? '');
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reviewerName = resolveReviewerName(transcript);
  const currentStepId = getReviewedTranscriptStepId(stepIndex);

  const steps = useMemo(
    () =>
      REVIEWED_TRANSCRIPT_WORKFLOW_STEPS.map((stepId) => ({
        id: stepId,
        label: t(reviewedTranscriptStepLabelKey(stepId)),
      })),
    [t],
  );

  const completedStepIndexes = useMemo(() => {
    const indexes: number[] = [];
    for (let index = 0; index < stepIndex; index += 1) {
      indexes.push(index);
    }
    return indexes;
  }, [stepIndex]);

  const validateUploadStep = (): string => {
    if (!selectedFile) {
      setUploadError(t('transcriptReviewedTranscriptRequired'));
      return 'transcriptReviewedTranscriptRequired';
    }

    const validationError = validateReviewedTranscriptFileName(
      transcript.jobNumber,
      selectedFile.name,
    );
    if (validationError) {
      setUploadError(t(validationError as TranslationKey));
      return validationError;
    }

    setUploadError('');
    return '';
  };

  const handleBack = () => {
    if (currentStepId === 'final_validation') {
      setStepIndex(0);
    }
  };

  const handleNext = () => {
    setError('');
    if (validateUploadStep()) return;
    setStepIndex(1);
  };

  const handleFinish = async () => {
    if (!selectedFile) {
      setError(t('transcriptReviewedTranscriptRequired'));
      setStepIndex(0);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await submitReviewedTranscriptWorkflow(transcript.id, {
        name: selectedFile.name,
        type: selectedFile.type || 'application/octet-stream',
        contentBase64: await readFileAsBase64(selectedFile),
        remarks: remarks.trim(),
      });
      const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
      onCompleted(message || t('transcriptReviewedSubmittedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkflowWizard
      title={t('transcriptReviewedWorkflowTitle').replace('{jobNumber}', transcript.jobNumber)}
      steps={steps}
      currentStepIndex={stepIndex}
      completedStepIndexes={completedStepIndexes}
      header={
        <SubmitReviewedTranscriptWorkflowHeader
          transcript={transcript}
          reviewerName={reviewerName}
        />
      }
      error={error}
      saving={saving}
      onCancel={onCancel}
      onBack={handleBack}
      onNext={handleNext}
      onFinish={handleFinish}
    >
      {currentStepId === 'reviewed_transcript_upload' ? (
        <ReviewedTranscriptUploadForm
          jobNumber={transcript.jobNumber}
          selectedFile={selectedFile}
          remarks={remarks}
          onFileChange={setSelectedFile}
          onRemarksChange={setRemarks}
          error={uploadError}
          onError={setUploadError}
        />
      ) : (
        <ReviewedTranscriptFinalValidationForm
          transcript={transcript}
          reviewerName={reviewerName}
          fileName={selectedFile?.name ?? ''}
          remarks={remarks.trim()}
          bypassApproval={transcript.bypassApproval === true}
        />
      )}
    </WorkflowWizard>
  );
}
