import { useMemo, useState } from 'react';
import { submitEditedTranscriptWorkflow } from '../../api/transcripts';
import WorkflowWizard from '../common/WorkflowWizard';
import {
  EDITED_TRANSCRIPT_WORKFLOW_STEPS,
  editedTranscriptStepLabelKey,
  getEditedTranscriptStepId,
  validateEditedTranscriptFileName,
} from '../../config/editedTranscriptWorkflow';
import { readFileAsBase64 } from '../../config/transcriptFiles';
import type { TranscriptRecord } from '../../types/transcript';
import { getAuthUser } from '../../utils/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import EditedTranscriptFinalValidationForm from './editedTranscript/EditedTranscriptFinalValidationForm';
import EditedTranscriptUploadForm from './editedTranscript/EditedTranscriptUploadForm';
import SubmitEditedTranscriptWorkflowHeader from './editedTranscript/SubmitEditedTranscriptWorkflowHeader';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface SubmitEditedTranscriptWorkflowProps {
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

function resolveEditorName(transcript: TranscriptRecord): string {
  const authUser = getAuthUser();
  if (authUser?.fullName?.trim()) return authUser.fullName.trim();
  if (authUser?.username?.trim()) return authUser.username.trim();
  if (transcript.editorName?.trim()) return transcript.editorName.trim();
  return '';
}

export default function SubmitEditedTranscriptWorkflow({
  transcript,
  onCancel,
  onCompleted,
}: SubmitEditedTranscriptWorkflowProps) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState(transcript.editorRemarks ?? '');
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const editorName = resolveEditorName(transcript);
  const currentStepId = getEditedTranscriptStepId(stepIndex);

  const steps = useMemo(
    () =>
      EDITED_TRANSCRIPT_WORKFLOW_STEPS.map((stepId) => ({
        id: stepId,
        label: t(editedTranscriptStepLabelKey(stepId)),
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
      setUploadError(t('transcriptEditedTranscriptRequired'));
      return 'transcriptEditedTranscriptRequired';
    }

    const validationError = validateEditedTranscriptFileName(transcript.jobNumber, selectedFile.name);
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
      setError(t('transcriptEditedTranscriptRequired'));
      setStepIndex(0);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await submitEditedTranscriptWorkflow(transcript.id, {
        name: selectedFile.name,
        type: selectedFile.type || 'application/zip',
        contentBase64: await readFileAsBase64(selectedFile),
        remarks: remarks.trim(),
      });
      const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
      onCompleted(message || t('transcriptEditedSubmittedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkflowWizard
      title={t('transcriptEditedWorkflowTitle').replace('{jobNumber}', transcript.jobNumber)}
      steps={steps}
      currentStepIndex={stepIndex}
      completedStepIndexes={completedStepIndexes}
      header={
        <SubmitEditedTranscriptWorkflowHeader transcript={transcript} editorName={editorName} />
      }
      error={error}
      saving={saving}
      onCancel={onCancel}
      onBack={handleBack}
      onNext={handleNext}
      onFinish={handleFinish}
    >
      {currentStepId === 'edited_transcript_upload' ? (
        <EditedTranscriptUploadForm
          jobNumber={transcript.jobNumber}
          selectedFile={selectedFile}
          remarks={remarks}
          onFileChange={setSelectedFile}
          onRemarksChange={setRemarks}
          error={uploadError}
          onError={setUploadError}
        />
      ) : (
        <EditedTranscriptFinalValidationForm
          transcript={transcript}
          editorName={editorName}
          fileName={selectedFile?.name ?? ''}
          remarks={remarks.trim()}
        />
      )}
    </WorkflowWizard>
  );
}
