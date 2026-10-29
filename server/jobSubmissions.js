import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findJobById, updateJob } from './jobs.js';
import { computeSystemTravellingChargeAmountForJob } from './jobTravellingCharges.js';
import { findProjectRecordById } from './projects.js';
import { canPerformJobWorkflowAction } from './jobCatalog.js';
import { queueNotification } from './notifications.js';
import { listUsers } from './db.js';
import { normalizeRoles } from './roles.js';
import { createTranscriptFromJobSubmission } from './transcripts.js';
import { countBillableTranscriptCharacters } from './transcriptMetrics.js';
import {
  emptyRawFilesBundle,
  normalizeRawFiles,
  validateRawFilesBundle,
} from './jobSubmissionRawFiles.js';
import {
  emptyAttachmentFilesBundle,
  normalizeAttachmentFiles,
  validateAttachmentFilesBundle,
} from './jobSubmissionAttachmentFiles.js';
const SUBMISSIONS_PATH = path.join(DB_DIR, 'jobSubmissions.json');

export const JOB_SUBMISSION_STEP_OPTIONS = [
  'raw_files',
  'attachment_files',
  'other_files',
  'same_day_actions',
  'job_receipt',
  'final_validation',
];

const RECEIPT_NUMBER_PATTERN = /^\d{5}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function readSubmissionsFile() {
  ensureCollectionFile('jobSubmissions', { submissions: [] });
  return readCollection('jobSubmissions', { submissions: [] });
}

function writeSubmissionsFile(data) {
  writeCollection('jobSubmissions', data);
}

function normalizeStep(value) {
  const step = typeof value === 'string' ? value.trim() : '';
  return JOB_SUBMISSION_STEP_OPTIONS.includes(step) ? step : 'raw_files';
}

function normalizeFileEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      id: typeof entry?.id === 'string' ? entry.id.trim() : `file-${crypto.randomUUID().slice(0, 8)}`,
      name: typeof entry?.name === 'string' ? entry.name.trim() : '',
      description: typeof entry?.description === 'string' ? entry.description.trim() : '',
      size: Number.isFinite(entry?.size) ? Number(entry.size) : 0,
      type: typeof entry?.type === 'string' ? entry.type.trim() : '',
      uploadedAt: typeof entry?.uploadedAt === 'string' ? entry.uploadedAt : new Date().toISOString(),
    }))
    .filter((entry) => entry.name);
}

function normalizeReceipt(value = {}) {
  const receiptNumberStenotypist =
    typeof value.receiptNumberStenotypist === 'string'
      ? value.receiptNumberStenotypist.trim()
      : '';
  const startTimeStenotypist =
    typeof value.startTimeStenotypist === 'string' ? value.startTimeStenotypist.trim() : '';
  const endTimeStenotypist =
    typeof value.endTimeStenotypist === 'string' ? value.endTimeStenotypist.trim() : '';

  return {
    receiptNumberStenotypist,
    startTimeStenotypist,
    endTimeStenotypist,
  };
}

function normalizeSubmissionAnalysis(input = {}) {
  const transcriptPlainText =
    typeof input.transcriptPlainText === 'string' ? input.transcriptPlainText : '';
  const transcriptTimestampsText =
    typeof input.transcriptTimestampsText === 'string' ? input.transcriptTimestampsText : '';
  const explicitCount = Number(input.transcriptCharacterCount);
  const transcriptCharacterCount =
    Number.isFinite(explicitCount) && explicitCount > 0
      ? explicitCount
      : transcriptPlainText.trim()
        ? countBillableTranscriptCharacters(transcriptPlainText)
        : 0;

  return {
    transcriptPlainText,
    transcriptTimestampsText,
    transcriptCharacterCount: transcriptCharacterCount > 0 ? transcriptCharacterCount : undefined,
  };
}

function normalizeSameDayActions(value = {}) {
  return {
    arrestWarrant: value.arrestWarrant === true,
    arrestWarrantDetails:
      typeof value.arrestWarrantDetails === 'string' ? value.arrestWarrantDetails.trim() : '',
    witnessSummons: value.witnessSummons === true,
    witnessSummonsDetails:
      typeof value.witnessSummonsDetails === 'string' ? value.witnessSummonsDetails.trim() : '',
    defendantTerms: value.defendantTerms === true,
    defendantTermsDetails:
      typeof value.defendantTermsDetails === 'string' ? value.defendantTermsDetails.trim() : '',
    welfareReport: value.welfareReport === true,
    welfareReportDetails:
      typeof value.welfareReportDetails === 'string' ? value.welfareReportDetails.trim() : '',
    otherDetails: typeof value.otherDetails === 'string' ? value.otherDetails.trim() : '',
  };
}

function validateSameDayActions(actions) {
  const errors = [];
  if (actions.arrestWarrant && !actions.arrestWarrantDetails) {
    errors.push('jobSubmissionSameDayActionDetailsRequired');
  }
  if (actions.witnessSummons && !actions.witnessSummonsDetails) {
    errors.push('jobSubmissionSameDayActionDetailsRequired');
  }
  if (actions.defendantTerms && !actions.defendantTermsDetails) {
    errors.push('jobSubmissionSameDayActionDetailsRequired');
  }
  if (actions.welfareReport && !actions.welfareReportDetails) {
    errors.push('jobSubmissionSameDayActionDetailsRequired');
  }
  return [...new Set(errors)];
}

function emptySubmission(jobId) {
  const now = new Date().toISOString();
  return {
    jobId,
    currentStep: 'raw_files',
    rawFiles: emptyRawFilesBundle(),
    attachmentFiles: emptyAttachmentFilesBundle(),
    otherFiles: [],
    sameDayActions: normalizeSameDayActions({}),
    receipt: {
      receiptNumberStenotypist: '',
      startTimeStenotypist: '',
      endTimeStenotypist: '',
    },
    transcriptPlainText: '',
    transcriptTimestampsText: '',
    transcriptCharacterCount: undefined,
    updatedAt: now,
  };
}

function migrateSubmission(submission) {
  const now = new Date().toISOString();
  return {
    ...emptySubmission(submission.jobId),
    ...submission,
    jobId: submission.jobId,
    currentStep: normalizeStep(submission.currentStep),
    rawFiles: normalizeRawFiles(submission.rawFiles),
    attachmentFiles: normalizeAttachmentFiles(submission.attachmentFiles),
    otherFiles: normalizeFileEntries(submission.otherFiles),
    sameDayActions: normalizeSameDayActions(submission.sameDayActions),
    receipt: normalizeReceipt(submission.receipt),
    ...normalizeSubmissionAnalysis(submission),
    updatedAt: submission.updatedAt ?? now,
  };
}

export function ensureJobSubmissionsDatabase() {
  ensureCollectionFile('jobSubmissions', { submissions: [] });
}

function actorCanSubmitJob(job, actor) {
  const roles = normalizeRoles(actor);
  const assignmentRoles = [];
  if (job.stenotypistUserId && actor?.id === job.stenotypistUserId) {
    assignmentRoles.push('stenotypist');
  }
  return canPerformJobWorkflowAction('upload_raw_data_attachments', {
    status: job.status,
    userOrRoles: roles,
    assignmentRoles,
  });
}

function listActiveUsersWithRoles(roleNames) {
  return listUsers().filter(
    (user) =>
      user.status === 'active' && normalizeRoles(user).some((role) => roleNames.includes(role)),
  );
}

function notifyJobSubmissionCompleted(job, transcript, actor) {
  const message = `Job ${job.jobNumber} submission completed. Transcript ${transcript.id} is now Finished.`;

  for (const user of listActiveUsersWithRoles(['coordinator', 'manager'])) {
    queueNotification({
      type: 'job_submission_completed',
      message,
      targetUserId: user.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/jobs-steno',
      entityType: 'job',
      entityId: job.id,
    });
  }

  const project = findProjectRecordById(job.projectId);
  for (const ownerId of project?.transcriptOwnerIds ?? []) {
    queueNotification({
      type: 'transcript_created',
      message: `Transcript for job ${job.jobNumber} has been created with status Finished.`,
      targetUserId: ownerId,
      createdByUserId: actor?.id ?? null,
      actionPath: '/transcripts/steno',
      entityType: 'transcript',
      entityId: transcript.id,
      emailDetails: [
        { label: 'Job Number', value: job.jobNumber },
        { label: 'Customer', value: job.customerName },
        { label: 'Status', value: 'Finished' },
      ],
    });
  }

  if (job.stenotypistUserId) {
    queueNotification({
      type: 'job_submission_completed',
      message: `Your submission for job ${job.jobNumber} has been completed successfully.`,
      targetUserId: job.stenotypistUserId,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/jobs-steno',
      entityType: 'job',
      entityId: job.id,
    });
  }
}

function validateReceipt(receipt) {
  const errors = [];
  if (!receipt.receiptNumberStenotypist) {
    errors.push('jobReceiptNumberStenotypistRequired');
  }
  if (!receipt.startTimeStenotypist) {
    errors.push('jobStartTimeStenotypistRequired');
  }
  if (!receipt.endTimeStenotypist) {
    errors.push('jobEndTimeStenotypistRequired');
  }
  if (
    receipt.receiptNumberStenotypist &&
    !RECEIPT_NUMBER_PATTERN.test(receipt.receiptNumberStenotypist)
  ) {
    errors.push('jobReceiptNumberStenotypistInvalid');
  }
  if (receipt.startTimeStenotypist && !TIME_PATTERN.test(receipt.startTimeStenotypist)) {
    errors.push('jobStartTimeStenotypistInvalid');
  }
  if (receipt.endTimeStenotypist && !TIME_PATTERN.test(receipt.endTimeStenotypist)) {
    errors.push('jobEndTimeStenotypistInvalid');
  }
  if (
    receipt.startTimeStenotypist &&
    receipt.endTimeStenotypist &&
    receipt.startTimeStenotypist > receipt.endTimeStenotypist
  ) {
    errors.push('jobStenotypistTimeRangeInvalid');
  }
  return errors;
}

export function getJobSubmission(jobId, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (!actorCanSubmitJob(job, actor)) {
    return { errors: ['jobSubmissionNotAllowed'] };
  }

  const data = readSubmissionsFile();
  const existing = (data.submissions ?? []).find((row) => row.jobId === jobId);
  const submission = existing ? migrateSubmission(existing) : emptySubmission(jobId);

  if (!existing) {
    submission.receipt = {
      receiptNumberStenotypist: job.receiptNumberStenotypist ?? '',
      startTimeStenotypist: job.startTimeStenotypist ?? '',
      endTimeStenotypist: job.endTimeStenotypist ?? '',
    };
  }

  return { submission };
}

export function saveJobSubmission(jobId, input, actor) {
  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (!actorCanSubmitJob(job, actor)) {
    return { errors: ['jobSubmissionNotAllowed'] };
  }

  const receipt = normalizeReceipt(input.receipt);
  const nextStep = normalizeStep(input.currentStep);
  if (nextStep === 'final_validation') {
    const receiptErrors = validateReceipt(receipt);
    if (receiptErrors.length > 0) {
      return { errors: receiptErrors };
    }
  }

  const rawFiles = normalizeRawFiles(input.rawFiles);
  const rawFileErrors = validateRawFilesBundle(job.jobNumber, rawFiles);
  if (nextStep !== 'raw_files' && rawFileErrors.length > 0) {
    return { errors: rawFileErrors };
  }

  const attachmentFiles = normalizeAttachmentFiles(input.attachmentFiles);
  const attachmentFileErrors = validateAttachmentFilesBundle(job.jobNumber, attachmentFiles);
  if (attachmentFileErrors.length > 0) {
    return { errors: attachmentFileErrors };
  }
  const sameDayActions = normalizeSameDayActions(input.sameDayActions);
  const sameDayErrors = validateSameDayActions(sameDayActions);
  if (sameDayErrors.length > 0) {
    return { errors: sameDayErrors };
  }

  const analysis = normalizeSubmissionAnalysis(input);

  const submission = {
    ...emptySubmission(jobId),
    currentStep: nextStep,
    rawFiles,
    attachmentFiles,
    otherFiles: normalizeFileEntries(input.otherFiles),
    sameDayActions,
    receipt,
    ...analysis,
    updatedAt: new Date().toISOString(),
  };

  const data = readSubmissionsFile();
  const index = (data.submissions ?? []).findIndex((row) => row.jobId === jobId);
  if (index === -1) {
    data.submissions.push(submission);
  } else {
    data.submissions[index] = submission;
  }
  writeSubmissionsFile(data);
  return { submission };
}

export function completeJobSubmission(jobId, input, actor) {
  const saveResult = saveJobSubmission(jobId, {
    ...input,
    currentStep: 'final_validation',
  }, actor);
  if (saveResult.errors) {
    return saveResult;
  }

  const job = findJobById(jobId);
  if (!job) {
    return { errors: ['jobNotFound'] };
  }
  if (job.status !== 'assigned') {
    return { errors: ['jobSubmissionInvalidStatus'] };
  }

  const transcriptResult = createTranscriptFromJobSubmission(job, saveResult.submission, actor, {
    status: 'finished',
    type: 'steno',
  });
  if (transcriptResult.errors) {
    return { errors: transcriptResult.errors };
  }

  const receipt = saveResult.submission.receipt;
  const travellingChargesSystem = computeSystemTravellingChargeAmountForJob({
    ...job,
    districtId: job.districtId,
    date: job.date,
    projectId: job.projectId,
  });
  const updateResult = updateJob(
    jobId,
    {
      projectId: job.projectId,
      districtId: job.districtId,
      date: job.date,
      time: job.time,
      stenotypistUserId: job.stenotypistUserId,
      locationDetails: job.locationDetails,
      remarks: job.remarks,
      expedite: job.expedite,
      status: 'finished',
      receiptNumberStenotypist: receipt.receiptNumberStenotypist,
      startTimeStenotypist: receipt.startTimeStenotypist,
      endTimeStenotypist: receipt.endTimeStenotypist,
      travellingChargesSystem,
    },
    actor,
  );
  if (updateResult.errors) {
    return { errors: updateResult.errors };
  }

  const completedAt = new Date().toISOString();
  const completedSubmission = {
    ...saveResult.submission,
    completedAt,
  };
  const data = readSubmissionsFile();
  const index = (data.submissions ?? []).findIndex((row) => row.jobId === jobId);
  if (index !== -1) {
    data.submissions[index] = completedSubmission;
    writeSubmissionsFile(data);
  }

  notifyJobSubmissionCompleted(job, transcriptResult.transcript, actor);

  return {
    submission: completedSubmission,
    transcript: transcriptResult.transcript,
    completed: true,
    job: updateResult.job,
  };
}
