export const JOB_SUBMISSION_STEP_OPTIONS = [
  'raw_files',
  'attachment_files',
  'other_files',
  'same_day_actions',
  'job_receipt',
  'final_validation',
] as const;

export type JobSubmissionStepId = (typeof JOB_SUBMISSION_STEP_OPTIONS)[number];

export interface JobSubmissionFileEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  textContent?: string;
}

export interface JobSubmissionRawFilesBundle {
  rawZip: JobSubmissionFileEntry | null;
  transcriptWithTimestamps: JobSubmissionFileEntry | null;
  transcript: JobSubmissionFileEntry | null;
}

export interface JobSubmissionAttachmentFilesBundle {
  personalDictionary: JobSubmissionFileEntry | null;
  evidenceList: JobSubmissionFileEntry | null;
}

export interface JobSubmissionOtherFileEntry extends JobSubmissionFileEntry {
  description: string;
}

export interface JobSubmissionReceiptData {
  receiptNumberStenotypist: string;
  startTimeStenotypist: string;
  endTimeStenotypist: string;
}

export interface JobSubmissionSameDayActions {
  arrestWarrant: boolean;
  arrestWarrantDetails: string;
  witnessSummons: boolean;
  witnessSummonsDetails: string;
  defendantTerms: boolean;
  defendantTermsDetails: string;
  welfareReport: boolean;
  welfareReportDetails: string;
  otherDetails: string;
}

export interface JobSubmissionRecord {
  jobId: string;
  currentStep: JobSubmissionStepId;
  rawFiles: JobSubmissionRawFilesBundle;
  attachmentFiles: JobSubmissionAttachmentFilesBundle;
  otherFiles: JobSubmissionOtherFileEntry[];
  sameDayActions: JobSubmissionSameDayActions;
  receipt: JobSubmissionReceiptData;
  transcriptPlainText?: string;
  transcriptTimestampsText?: string;
  transcriptCharacterCount?: number;
  updatedAt: string;
  completedAt?: string;
}

export interface JobSubmissionPayload {
  currentStep?: JobSubmissionStepId;
  rawFiles?: JobSubmissionRawFilesBundle;
  attachmentFiles?: JobSubmissionAttachmentFilesBundle;
  otherFiles?: JobSubmissionOtherFileEntry[];
  sameDayActions?: JobSubmissionSameDayActions;
  receipt?: JobSubmissionReceiptData;
  transcriptPlainText?: string;
  transcriptTimestampsText?: string;
  transcriptCharacterCount?: number;
}
