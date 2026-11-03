import express from 'express';
import cors from 'cors';
import {
  changeUserPassword,
  createUser,
  deleteUser,
  ensureDatabase,
  findUserByEmail,
  findUserById,
  findUserByIdWithPolicy,
  getUserIdFromToken,
  isUserActive,
  listCustomers,
  listUsers,
  requestPasswordResetForEmail,
  resetUserPasswordWithToken,
  toPublicUser,
  updateUser,
  updateUserProfile,
  updateAccountProfile,
  updateUserStatus,
  validatePasswordResetToken,
  verifyPassword,
} from './db.js';
import {
  canAccessStenotypistLeaveModule,
  canAccessTravellingChargesModule,
  canAccessJobReconciliationModule,
  canAccessCustomerInvoicingModule,
  canAccessBonusConfigurationModule,
  canAccessStenotypistBonusesModule,
  canAccessPenaltyConfigurationModule,
  canAccessStenotypistPenaltiesModule,
  canAccessTravelExpenseConfigurationModule,
  canAccessTravelExpenseListModule,
  canAccessStenotypistFinancialsReportModule,
  hasPermission,
} from './permissions.js';
import {
  createNotification,
  dispatchNotification,
  listNotificationsForActor,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.js';
import { deliverEmailNotification } from './emailDelivery.js';
import { loadEmailEnvFile } from './emailConfig.js';
import { buildAppActionUrl } from './notificationChannels.js';
import { sendAccountEmailChangeNotifications } from './accountEmails.js';
import { sendUserEnrollmentEmail } from './mfaEnrollmentEmail.js';
import { createMfaSession, consumeMfaSession } from './mfaSessions.js';
import { generateTotp, verifyTotp } from './totp.js';
import {
  createStenotypistAsset,
  deleteStenotypistAsset,
  ensureAssetsFile,
  findStenotypistAssetById,
  listStenotypistAssets,
  updateStenotypistAsset,
} from './stenotypistAssets.js';
import {
  createCustomer,
  createCustomerFieldValue,
  deleteCustomer,
  deleteCustomerFieldValue,
  findCustomerRecordById,
  listCustomerFieldValues,
  listCustomerRecords,
  replaceCustomerFieldValues,
  updateCustomer,
  updateCustomerFieldValue,
} from './customers.js';
import { listDistricts, listDistrictRecords, createDistrict, updateDistrict, deleteDistrict, findDistrictRecordById } from './districts.js';
import {
  createProject,
  deleteProject,
  findProjectRecordById,
  listProjectRecords,
  listTranscriptOwnerCandidates,
  updateProject,
  updateProjectStatus,
} from './projects.js';
import {
  createPublicHoliday,
  deletePublicHoliday,
  findPublicHolidayRecordById,
  listPublicHolidayRecords,
  updatePublicHoliday,
} from './publicHolidays.js';
import {
  createStenotypistLeave,
  deleteStenotypistLeave,
  findStenotypistLeaveRecordById,
  listStenotypistCandidates,
  listStenotypistLeaveRecords,
  STENOTYPIST_LEAVE_REASONS,
  STENOTYPIST_LEAVE_STATUSES,
  updateStenotypistLeave,
  updateStenotypistLeaveStatus,
} from './stenotypistLeaves.js';
import {
  createTravellingTime,
  deleteTravellingTime,
  findTravellingTimeRecordById,
  listTravellingTimeRecords,
  updateTravellingTime,
} from './travellingTimes.js';
import { getJobCatalog } from './jobCatalog.js';
import {
  approveJob,
  assignJob,
  confirmAllPendingJobs,
  confirmJob,
  createJob,
  deleteJob,
  findJobRecordById,
  JOB_RECONCILIATION_STATUS_OPTIONS,
  JOB_REJECTION_REASON_OPTIONS,
  listJobRecords,
  listJobStenotypistCandidates,
  matrixAllocateJob,
  matrixUnassignJob,
  rejectJob,
  updateJob,
} from './jobs.js';
import {
  completeJobSubmission,
  getJobSubmission,
  saveJobSubmission,
} from './jobSubmissions.js';
import { getJobMatrix, getStenotypistSummaryReport } from './jobMatrix.js';
import { getStenotypistAssignmentsPerDistrictReport } from './stenotypistAssignmentsPerDistrictReport.js';
import { canAccessJobList, canAccessJobRecord } from './jobAccess.js';
import { getStenotypistInfoPanel } from './stenotypistInfoPanel.js';
import {
  findTranscriptRecordById,
  getTranscriptForActor,
  listTranscriptParticipantCandidates,
  listTranscriptPublisherCandidates,
  queryTranscriptList,
  updateTranscriptRecord,
} from './transcripts.js';
import { buildTranscriptReport } from './transcriptReport.js';
import { buildTranscriptsAnalysisReport } from './transcriptAnalysisReport.js';
import {
  publishTranscript,
  submitEditedTranscript,
  submitReviewedTranscript,
} from './transcriptWorkflow.js';
import {
  addTranscriptOtherFile,
  getTranscriptFileDownload,
  getTranscriptFileHistory,
  getTranscriptFilesList,
  updateTranscriptFile,
} from './transcriptFiles.js';
import { ensureTranscriptFileStorageRoot } from './transcriptFileStorage.js';
import { TRAVELLING_CHARGES_OPTIONS } from './customers.js';
import {
  createTravellingCharge,
  deleteTravellingCharge,
  ensureTravellingChargesDatabase,
  findTravellingChargeRecordById,
  listTravellingChargeRecords,
  resolveTravellingChargeAmount,
  updateTravellingCharge,
} from './travellingCharges.js';
import {
  createBonusConfigurationRecord,
  deleteBonusConfigurationRecord,
  findBonusConfigurationRecordById,
  listBonusConfigurationRecords,
  listBonusStenotypistCandidates,
  updateBonusConfigurationRecord,
} from './stenotypistBonus.js';
import {
  listBonusesStenotypistCandidates,
  listMonthlyBonusRecords,
} from './stenotypistBonuses.js';
import {
  createPenaltyConfigurationRecord,
  deletePenaltyConfigurationRecord,
  findPenaltyConfigurationRecordById,
  listPenaltyConfigurationRecords,
  updatePenaltyConfigurationRecord,
} from './stenotypistPenalty.js';
import {
  listPenaltiesStenotypistCandidates,
  listPenaltyRecords,
} from './stenotypistPenalties.js';
import {
  createTravelExpenseRecord,
  deleteTravelExpenseRecord,
  findTravelExpenseRecordById,
  listTravelExpenseRecords,
  listTravelExpenseStenotypistCandidates,
  resolveTravelExpenseAmount,
  updateTravelExpenseRecord,
} from './travelExpenses.js';
import {
  approveJobTravelExpense,
  findJobTravelExpenseRecordByJobId,
  listJobTravelExpenseRecords,
  listJobTravelExpenseStenotypistCandidates,
  rejectJobTravelExpense,
} from './jobTravelExpenses.js';
import {
  listStenotypistFinancialsReportCandidates,
  listStenotypistFinancialsReportRecords,
} from './stenotypistFinancialsReport.js';
import {
  ensureAuditTrailDatabase,
  findAuditTrailRecordById,
  listAuditTrailFilterOptions,
  listAuditTrailRecords,
  recordAuditEntry,
  buildCreatedDetailsFromMap,
  buildUpdatedDetailsFromMaps,
  buildEmptyEntryDetails,
  buildSessionOpenedEntryDetails,
  getUserAuditFieldMap,
  recordUserRoleChangeEntries,
  getCustomerAuditFieldMap,
  getCustomerFieldAuditFieldMap,
  getProjectAuditFieldMap,
  recordProjectTranscriptOwnerChangeEntries,
  getPublicHolidayAuditFieldMap,
  getStenotypistLeaveAuditFieldMap,
  getTravellingTimeAuditFieldMap,
  getJobAuditFieldMap,
  getTranscriptAuditFieldMap,
  getTravellingChargeAuditFieldMap,
  getProformaAuditFieldMap,
  getStenotypistBonusAuditFieldMap,
  getStenotypistPenaltyAuditFieldMap,
  getTravelExpenseAuditFieldMap,
  getJobTravelExpenseAuditFieldMap,
  recordJobSubmissionChangeEntries,
  formatFileSizeBytes,
  buildFileTransferEntryDetails,
} from './auditTrail.js';
import {
  confirmJobReconciliation,
  findJobReconciliationRecord,
  listJobReconciliationRecords,
  updateJobReconciliation,
} from './jobReconciliation.js';
import {
  createProformaRecord,
  findProformaById,
  findProformaItems,
  getProformaTrackingSummary,
  listProformaEligibleJobs,
  listProformaRecords,
  postProformaToPriorityErp,
  repostProformaRecord,
  voidProformaRecord,
} from './proformas.js';
import {
  generateProformasFromProcess,
  listProformaProcessRecords,
} from './proformaProcess.js';
import {
  findPriorityErpExportById,
  getPriorityErpExportDownloadFilename,
  getPriorityErpExportDownloadContent,
} from './priorityErpExport.js';
import {
  getPriorityErpImportProcedureSpec,
  validatePriorityErpImportFile,
} from './priorityErpImportValidation.js';
import {
  hydrateFromSupabase,
  flushPendingWrites,
  useRemoteStore,
} from './collectionStore.js';
import {
  createAuthSession,
  hydrateAuthSessions,
  revokeAuthSession,
} from './authSessions.js';
import { isSupabaseConfigured, isVercelRuntime } from './supabase.js';

const PORT = 3001;

loadEmailEnvFile();

let localBootPromise = null;
let remoteBootstrapped = false;

async function ensureAppReady() {
  if (isVercelRuntime() && !isSupabaseConfigured()) {
    throw new Error(
      'Supabase env vars missing on Vercel. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  // On Supabase/Vercel, re-read collections every request so deletes/creates are
  // visible across warm serverless instances (in-memory cache would otherwise go stale).
  if (useRemoteStore()) {
    await flushPendingWrites();
    await hydrateFromSupabase({ force: true });
    if (!remoteBootstrapped) {
      await hydrateAuthSessions();
      ensureDatabase();
      ensureAssetsFile();
      ensureTranscriptFileStorageRoot();
      ensureTravellingChargesDatabase();
      ensureAuditTrailDatabase();
      remoteBootstrapped = true;
    }
    return;
  }

  if (!localBootPromise) {
    localBootPromise = (async () => {
      ensureDatabase();
      ensureAssetsFile();
      ensureTranscriptFileStorageRoot();
      ensureTravellingChargesDatabase();
      ensureAuditTrailDatabase();
    })();
  }
  await localBootPromise;
}

// Never eagerly boot local JSON on Vercel (read-only FS / cold start crashes).
if (!useRemoteStore() && !isVercelRuntime()) {
  void ensureAppReady();
}

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) || true,
}));
app.use(express.json({ limit: '25mb' }));

app.use(async (req, res, next) => {
  try {
    await ensureAppReady();
    next();
  } catch (error) {
    console.error('[boot]', error);
    res.status(500).json({ error: 'Server failed to initialize.' });
  }
});

app.use((req, res, next) => {
  res.on('finish', () => {
    void flushPendingWrites();
  });
  next();
});

function getAuthedUser(req) {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const userId = getUserIdFromToken(token);
  if (!userId) return null;
  return findUserByIdWithPolicy(userId);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function requireAdminUsers(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'administration.users')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireAuditTrail(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'administration.audit_trail')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireStenotypistAssets(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'administration.stenotypist_assets')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireProjectsCustomers(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'projects.customers')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireProjectsRecords(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'projects.projects')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireDistrictLookup(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (
    !hasPermission(user, 'projects.projects') &&
    !hasPermission(user, 'projects.district')
  ) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireProjectsDistrict(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'projects.district')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireSchedulingPublicHolidays(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'scheduling.public_holidays')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireSchedulingStenotypistLeave(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessStenotypistLeaveModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireSchedulingTravellingTime(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'scheduling.travelling_time')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsTravellingCharges(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessTravellingChargesModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsReconciliation(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessJobReconciliationModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsStenotypistBonus(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessBonusConfigurationModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsStenotypistBonuses(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessStenotypistBonusesModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsStenotypistPenalty(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessPenaltyConfigurationModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsStenotypistPenalties(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessStenotypistPenaltiesModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsTravelExpenses(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessTravelExpenseConfigurationModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsTravelExpenseList(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessTravelExpenseListModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireFinancialsStenotypistFinancialsReport(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessStenotypistFinancialsReportModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireSchedulingJobs(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (
    !canAccessJobList(user) &&
    !hasPermission(user, 'scheduling.jobs') &&
    !hasPermission(user, 'scheduling.job_allocation')
  ) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireSchedulingReports(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'scheduling.scheduling_reports')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireTranscripts(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'transcripts.transcripts')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireTranscriptsAnalysisReport(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'transcripts.transcripts_analysis_report')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function requireCustomerLookup(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (
    !hasPermission(user, 'projects.customers') &&
    !hasPermission(user, 'projects.projects') &&
    !hasPermission(user, 'administration.users')
  ) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

function rejectIfPasswordChangeRequired(user, res) {
  if (user?.mustChangePassword) {
    res.status(403).json({
      error: 'You must change your password before continuing.',
      errorCode: 'passwordChangeRequired',
    });
    return true;
  }
  return false;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    store: useRemoteStore() ? 'supabase' : 'local-json',
    timestamp: new Date().toISOString(),
  });
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email) {
    res.status(400).json({ error: 'Email address is required.', errorCode: 'emailRequired' });
    return;
  }

  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Email address format is invalid.', errorCode: 'emailInvalid' });
    return;
  }

  if (!password) {
    res.status(400).json({ error: 'Password is required.', errorCode: 'passwordRequired' });
    return;
  }

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.', errorCode: 'invalidCredentials' });
    return;
  }

  if (!isUserActive(user)) {
    res.status(403).json({
      error: 'This account is inactive. Contact an administrator.',
      errorCode: 'accountInactive',
    });
    return;
  }

  if (!user.mfaEnabled || !user.totpSecret) {
    res.status(500).json({ error: 'MFA is not configured for this account.' });
    return;
  }

  const mfaToken = await createMfaSession(user.id);
  const devCode = generateTotp(user.totpSecret);
  console.log(`[MFA] ${user.email} — current code: ${devCode} (valid ~30s, also in API terminal)`);

  res.json({
    requiresMfa: true,
    mfaToken,
    email: user.email,
  });
});

app.post('/api/auth/verify-mfa', async (req, res) => {
  const mfaToken = typeof req.body?.mfaToken === 'string' ? req.body.mfaToken : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!mfaToken || !code) {
    res.status(400).json({ error: 'MFA token and code are required.' });
    return;
  }

  const userId = await consumeMfaSession(mfaToken);
  if (!userId) {
    res.status(401).json({ error: 'MFA session expired. Please sign in again.' });
    return;
  }

  const user = findUserByIdWithPolicy(userId);
  if (!user?.totpSecret || !verifyTotp(user.totpSecret, code)) {
    res.status(401).json({ error: 'Invalid authentication code.', errorCode: 'invalidMfaCode' });
    return;
  }

  if (!isUserActive(user)) {
    res.status(403).json({
      error: 'This account is inactive. Contact an administrator.',
      errorCode: 'accountInactive',
    });
    return;
  }

  recordAuditEntry({
    actor: user,
    module: 'administration',
    entityName: 'program_access',
    entityNumber: user.username || user.id,
    entryType: 'session_opened',
    entryDetails: buildSessionOpenedEntryDetails(req.headers['user-agent'] ?? ''),
  });

  const token = await createAuthSession(user.id);
  res.json({
    user: toPublicUser(user),
    token,
  });
});

app.post('/api/auth/logout', async (req, res) => {
  const actor = getAuthedUser(req);
  if (actor) {
    recordAuditEntry({
      actor,
      module: 'administration',
      entityName: 'program_access',
      entityNumber: actor.username || actor.id,
      entryType: 'session_closed',
      entryDetails: buildEmptyEntryDetails(),
    });
  }
  const bearer = getBearerToken(req);
  if (bearer) {
    await revokeAuthSession(bearer);
  }
  res.json({ success: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email) {
    res.status(400).json({ error: 'Email address is required.', errorCode: 'emailRequired' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Email address format is invalid.', errorCode: 'emailInvalid' });
    return;
  }

  const result = await requestPasswordResetForEmail(email);
  if (result.token) {
    const resetLink = buildAppActionUrl(`/reset-password?token=${result.token}`);
    await deliverEmailNotification({
      to: result.email,
      message: 'A password reset was requested for your Stenotipisi account.',
      actionUrl: resetLink,
      senderKey: 'account',
      messageType: 'password_reset',
      recipientName: findUserByEmail(result.email)?.fullName || '',
      details: [{ label: 'Email Address', value: result.email }],
      instructions:
        'Use the secure link below to choose a new password. The link is valid for about one hour. If you did not request this reset, you can ignore this email.',
      primaryActionLabel: 'Reset password',
    });
    await dispatchNotification({
      type: 'password_reset',
      message: 'A password reset link was sent to your email address.',
      targetUserId: findUserByEmail(result.email)?.id ?? null,
      actionUrl: resetLink,
      channels: ['online'],
    });
  }

  res.json({ success: true });
});

app.get('/api/auth/reset-password/validate', async (req, res) => {
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const result = await validatePasswordResetToken(token);
  if (!result.valid) {
    res.status(400).json({ valid: false, errorCode: 'resetTokenInvalid' });
    return;
  }
  res.json({ valid: true, email: result.email });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  const result = await resetUserPasswordWithToken(token, newPassword);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'password_reset',
    message: `User ${result.user.fullName} reset their password.`,
    targetUserId: result.user.id,
    createdByUserId: result.user.id,
  });

  res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  res.json(toPublicUser(user));
});

function requireNotifications(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!hasPermission(user, 'administration.notifications')) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

app.get('/api/notifications', (req, res) => {
  const actor = requireNotifications(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listNotificationsForActor(actor, {
    unreadOnly: req.query.unreadOnly === 'true' || req.query.unreadOnly === '1',
  });
  if (result.errors) {
    res.status(403).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/notifications/:id/read', (req, res) => {
  const actor = requireNotifications(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = markNotificationRead(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('notificationNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.notification);
});

app.post('/api/notifications/read-all', (req, res) => {
  const actor = requireNotifications(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = markAllNotificationsRead(actor);
  if (result.errors) {
    res.status(403).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.put('/api/profile', async (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  if (rejectIfPasswordChangeRequired(user, res)) return;

  const body = req.body ?? {};
  const result = updateAccountProfile(user.id, {
    fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
    username: typeof body.username === 'string' ? body.username : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : undefined,
    mobilePhone: typeof body.mobilePhone === 'string' ? body.mobilePhone : undefined,
    language: body.language === 'el' ? 'el' : body.language === 'en' ? 'en' : undefined,
    autoRefresh: body.autoRefresh !== undefined ? Boolean(body.autoRefresh) : undefined,
  });

  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  if (result.emailChanged) {
    await sendAccountEmailChangeNotifications({
      user: result.user,
      oldEmail: result.oldEmail,
      newEmail: result.newEmail,
      actorUserId: user.id,
    });

    createNotification({
      type: 'account_email_changed',
      message: `User ${result.user.fullName} changed account email from ${result.oldEmail} to ${result.newEmail}.`,
      targetUserId: result.user.id,
      createdByUserId: user.id,
    });
  }

  res.json({
    user: result.user,
    emailChanged: result.emailChanged,
  });
});

app.put('/api/profile/password', async (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  const result = changeUserPassword(user.id, currentPassword, newPassword);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'password_changed',
    message: `User ${result.user.fullName} changed their password.`,
    targetUserId: result.user.id,
    createdByUserId: user.id,
  });

  await dispatchNotification({
    type: 'password_changed',
    message: 'Your password was changed successfully.',
    targetUserId: result.user.id,
    createdByUserId: user.id,
    actionPath: '/signin',
    channels: ['email'],
  });

  res.json(result.user);
});

app.get('/api/customers', (req, res) => {
  const actor = requireCustomerLookup(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ customers: listCustomers() });
});

app.get('/api/customers/records', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ customers: listCustomerRecords() });
});

app.get('/api/customers/records/:id', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const customer = findCustomerRecordById(req.params.id);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  res.json(customer);
});

app.post('/api/customers/records', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createCustomer(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'customer_created',
    message: `Customer ${result.customer.name} (${result.customer.customerNumber}) was created.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'customer',
    entityNumber: result.customer.customerNumber || result.customer.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getCustomerAuditFieldMap(result.customer)),
  });

  res.status(201).json(result.customer);
});

app.put('/api/customers/records/:id', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findCustomerRecordById(req.params.id);
  const result = updateCustomer(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'customer_updated',
    message: `Customer ${result.customer.name} (${result.customer.customerNumber}) was updated.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getCustomerAuditFieldMap(before),
    getCustomerAuditFieldMap(result.customer),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'customer',
      entityNumber: result.customer.customerNumber || result.customer.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.customer);
});

app.delete('/api/customers/records/:id', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteCustomer(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'customer_deleted',
    message: `Customer ${result.customer.name} (${result.customer.customerNumber}) was deleted.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'customer',
    entityNumber: result.customer.customerNumber || result.customer.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.customer);
});

app.get('/api/customers/records/:id/field-values', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const fieldReference = req.query?.fieldReference;
  const result = listCustomerFieldValues(
    req.params.id,
    fieldReference === undefined ? null : fieldReference,
  );
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json({ values: result.values });
});

app.post('/api/customers/records/:id/field-values', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createCustomerFieldValue(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const customer = findCustomerRecordById(req.params.id);
  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'customer_fields',
    entityNumber: result.fieldValue.value || result.fieldValue.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(
      getCustomerFieldAuditFieldMap(result.fieldValue, customer),
    ),
  });

  res.status(201).json(result.fieldValue);
});

app.put('/api/customers/records/:id/field-values/:fieldValueId', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const customer = findCustomerRecordById(req.params.id);
  const beforeList = listCustomerFieldValues(req.params.id);
  const before =
    beforeList.values?.find((row) => row.id === req.params.fieldValueId) ?? null;

  const result = updateCustomerFieldValue(req.params.id, req.params.fieldValueId, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ||
      result.errors.includes('customerFieldValueNotFound')
      ? 404
      : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getCustomerFieldAuditFieldMap(before, customer),
    getCustomerFieldAuditFieldMap(result.fieldValue, customer),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'customer_fields',
      entityNumber: result.fieldValue.value || result.fieldValue.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.fieldValue);
});

app.delete('/api/customers/records/:id/field-values/:fieldValueId', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteCustomerFieldValue(req.params.id, req.params.fieldValueId);
  if (result.errors) {
    const status = result.errors.includes('customerFieldValueNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'customer_fields',
    entityNumber: result.fieldValue.value || result.fieldValue.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json({ success: true, fieldValue: result.fieldValue });
});

app.put('/api/customers/records/:id/field-options/:fieldReference', (req, res) => {
  const actor = requireProjectsCustomers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const fieldReference = Number(req.params.fieldReference);
  const customer = findCustomerRecordById(req.params.id);
  const beforeList = listCustomerFieldValues(req.params.id, fieldReference);
  const beforeValues = beforeList.values ?? [];

  const result = replaceCustomerFieldValues(
    req.params.id,
    fieldReference,
    req.body?.items ?? [],
  );
  if (result.errors) {
    const status = result.errors.includes('customerNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const afterValues = result.values ?? [];
  const beforeByValue = new Map(beforeValues.map((row) => [row.value, row]));
  const afterByValue = new Map(afterValues.map((row) => [row.value, row]));

  for (const [value, row] of afterByValue) {
    const previous = beforeByValue.get(value);
    if (!previous) {
      recordAuditEntry({
        actor,
        module: 'projects',
        entityName: 'customer_fields',
        entityNumber: row.value || row.id,
        entryType: 'created',
        entryDetails: buildCreatedDetailsFromMap(getCustomerFieldAuditFieldMap(row, customer)),
      });
      continue;
    }
    const fieldChanges = buildUpdatedDetailsFromMaps(
      getCustomerFieldAuditFieldMap(previous, customer),
      getCustomerFieldAuditFieldMap(row, customer),
    );
    if ((fieldChanges.fields ?? []).length > 0) {
      recordAuditEntry({
        actor,
        module: 'projects',
        entityName: 'customer_fields',
        entityNumber: row.value || row.id,
        entryType: 'updated',
        entryDetails: fieldChanges,
      });
    }
  }

  for (const [value, row] of beforeByValue) {
    if (afterByValue.has(value)) continue;
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'customer_fields',
      entityNumber: row.value || row.id,
      entryType: 'deleted',
      entryDetails: buildEmptyEntryDetails(),
    });
  }

  res.json({ values: result.values });
});

app.get('/api/districts', (req, res) => {
  const actor = requireDistrictLookup(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ districts: listDistricts() });
});

app.get('/api/districts/records', (req, res) => {
  const actor = requireProjectsDistrict(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ districts: listDistrictRecords() });
});

app.get('/api/districts/records/:id', (req, res) => {
  const actor = requireProjectsDistrict(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const district = findDistrictRecordById(req.params.id);
  if (!district) {
    res.status(404).json({ errors: ['districtNotFound'] });
    return;
  }

  res.json(district);
});

app.post('/api/districts/records', (req, res) => {
  const actor = requireProjectsDistrict(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createDistrict(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.status(201).json(result.district);
});

app.put('/api/districts/records/:id', (req, res) => {
  const actor = requireProjectsDistrict(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = updateDistrict(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('districtNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.district);
});

app.delete('/api/districts/records/:id', (req, res) => {
  const actor = requireProjectsDistrict(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteDistrict(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('districtNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.district);
});

app.get('/api/scheduling/public-holidays/records', (req, res) => {
  const actor = requireSchedulingPublicHolidays(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ holidays: listPublicHolidayRecords() });
});

app.get('/api/scheduling/public-holidays/records/:id', (req, res) => {
  const actor = requireSchedulingPublicHolidays(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const holiday = findPublicHolidayRecordById(req.params.id);
  if (!holiday) {
    res.status(404).json({ errors: ['publicHolidayNotFound'] });
    return;
  }

  res.json(holiday);
});

app.post('/api/scheduling/public-holidays/records', (req, res) => {
  const actor = requireSchedulingPublicHolidays(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createPublicHoliday(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'public_holiday',
    entityNumber: result.holiday.date || result.holiday.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getPublicHolidayAuditFieldMap(result.holiday)),
  });

  res.status(201).json(result.holiday);
});

app.put('/api/scheduling/public-holidays/records/:id', (req, res) => {
  const actor = requireSchedulingPublicHolidays(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findPublicHolidayRecordById(req.params.id);
  const result = updatePublicHoliday(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('publicHolidayNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getPublicHolidayAuditFieldMap(before),
    getPublicHolidayAuditFieldMap(result.holiday),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'public_holiday',
      entityNumber: result.holiday.date || result.holiday.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.holiday);
});

app.delete('/api/scheduling/public-holidays/records/:id', (req, res) => {
  const actor = requireSchedulingPublicHolidays(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deletePublicHoliday(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('publicHolidayNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'public_holiday',
    entityNumber: result.holiday.date || result.holiday.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.holiday);
});

app.get('/api/scheduling/stenotypist-leaves/records', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ leaves: listStenotypistLeaveRecords(actor) });
});

app.get('/api/scheduling/stenotypist-leaves/records/:id', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const leave = findStenotypistLeaveRecordById(req.params.id, actor);
  if (!leave) {
    res.status(404).json({ errors: ['stenotypistLeaveNotFound'] });
    return;
  }

  res.json(leave);
});

app.get('/api/scheduling/stenotypist-leaves/options', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({
    reasons: STENOTYPIST_LEAVE_REASONS,
    statuses: STENOTYPIST_LEAVE_STATUSES,
  });
});

app.get('/api/scheduling/stenotypist-leaves/stenotypist-candidates', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ candidates: listStenotypistCandidates(actor) });
});

app.post('/api/scheduling/stenotypist-leaves/records', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createStenotypistLeave(req.body ?? {}, actor);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'stenotypist_leave',
    entityNumber:
      `${result.leave.stenotypistUsername || result.leave.stenotypistUserId} ${result.leave.dateFrom}–${result.leave.dateTo}`.trim() ||
      result.leave.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getStenotypistLeaveAuditFieldMap(result.leave)),
  });

  res.status(201).json(result.leave);
});

app.put('/api/scheduling/stenotypist-leaves/records/:id', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findStenotypistLeaveRecordById(req.params.id, actor);
  const result = updateStenotypistLeave(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('stenotypistLeaveNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getStenotypistLeaveAuditFieldMap(before),
    getStenotypistLeaveAuditFieldMap(result.leave),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'stenotypist_leave',
      entityNumber:
        `${result.leave.stenotypistUsername || result.leave.stenotypistUserId} ${result.leave.dateFrom}–${result.leave.dateTo}`.trim() ||
        result.leave.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.leave);
});

app.patch('/api/scheduling/stenotypist-leaves/records/:id/status', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findStenotypistLeaveRecordById(req.params.id, actor);
  const result = updateStenotypistLeaveStatus(req.params.id, req.body?.status, actor);
  if (result.errors) {
    const status = result.errors.includes('stenotypistLeaveNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getStenotypistLeaveAuditFieldMap(before),
    getStenotypistLeaveAuditFieldMap(result.leave),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'stenotypist_leave',
      entityNumber:
        `${result.leave.stenotypistUsername || result.leave.stenotypistUserId} ${result.leave.dateFrom}–${result.leave.dateTo}`.trim() ||
        result.leave.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.leave);
});

app.delete('/api/scheduling/stenotypist-leaves/records/:id', (req, res) => {
  const actor = requireSchedulingStenotypistLeave(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteStenotypistLeave(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('stenotypistLeaveNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'stenotypist_leave',
    entityNumber:
      `${result.leave.stenotypistUsername || result.leave.stenotypistUserId} ${result.leave.dateFrom}–${result.leave.dateTo}`.trim() ||
      result.leave.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.leave);
});

app.get('/api/scheduling/travelling-times/records', (req, res) => {
  const actor = requireSchedulingTravellingTime(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ trips: listTravellingTimeRecords() });
});

app.get('/api/scheduling/travelling-times/records/:id', (req, res) => {
  const actor = requireSchedulingTravellingTime(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const trip = findTravellingTimeRecordById(req.params.id);
  if (!trip) {
    res.status(404).json({ errors: ['travellingTimeNotFound'] });
    return;
  }

  res.json(trip);
});

app.post('/api/scheduling/travelling-times/records', (req, res) => {
  const actor = requireSchedulingTravellingTime(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createTravellingTime(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'travelling_time',
    entityNumber:
      `${result.trip.district1Alias || result.trip.district1Name}-${result.trip.district2Alias || result.trip.district2Name} @ ${result.trip.validityFrom}`.trim() ||
      result.trip.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getTravellingTimeAuditFieldMap(result.trip)),
  });

  res.status(201).json(result.trip);
});

app.put('/api/scheduling/travelling-times/records/:id', (req, res) => {
  const actor = requireSchedulingTravellingTime(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findTravellingTimeRecordById(req.params.id);
  const result = updateTravellingTime(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('travellingTimeNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getTravellingTimeAuditFieldMap(before),
    getTravellingTimeAuditFieldMap(result.trip),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'travelling_time',
      entityNumber:
        `${result.trip.district1Alias || result.trip.district1Name}-${result.trip.district2Alias || result.trip.district2Name} @ ${result.trip.validityFrom}`.trim() ||
        result.trip.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.trip);
});

app.delete('/api/scheduling/travelling-times/records/:id', (req, res) => {
  const actor = requireSchedulingTravellingTime(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteTravellingTime(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('travellingTimeNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'travelling_time',
    entityNumber:
      `${result.trip.district1Alias || result.trip.district1Name}-${result.trip.district2Alias || result.trip.district2Name} @ ${result.trip.validityFrom}`.trim() ||
      result.trip.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.trip);
});

app.get('/api/financials/travelling-charges', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  res.json({
    charges: listTravellingChargeRecords({
      customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
      districtId: typeof req.query.districtId === 'string' ? req.query.districtId : '',
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    }),
  });
});

app.get('/api/financials/travelling-charges/resolve', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : '';
  const districtId = typeof req.query.districtId === 'string' ? req.query.districtId : '';
  const jobDate = typeof req.query.jobDate === 'string' ? req.query.jobDate : '';
  const amount = resolveTravellingChargeAmount(customerId, districtId, jobDate);
  res.json({ amount });
});

app.get('/api/financials/travelling-charges/:id', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const charge = findTravellingChargeRecordById(req.params.id);
  if (!charge) {
    res.status(404).json({ errors: ['travellingChargeNotFound'] });
    return;
  }

  res.json(charge);
});

app.post('/api/financials/travelling-charges', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createTravellingCharge(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'travelling_charge',
    entityNumber:
      `${result.charge.customerAlias || result.charge.customerName}-${result.charge.districtAlias || result.charge.districtName} @ ${result.charge.validityFrom}`.trim() ||
      result.charge.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getTravellingChargeAuditFieldMap(result.charge)),
  });

  res.status(201).json(result.charge);
});

app.put('/api/financials/travelling-charges/:id', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findTravellingChargeRecordById(req.params.id);
  const result = updateTravellingCharge(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('travellingChargeNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getTravellingChargeAuditFieldMap(before),
    getTravellingChargeAuditFieldMap(result.charge),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'travelling_charge',
      entityNumber:
        `${result.charge.customerAlias || result.charge.customerName}-${result.charge.districtAlias || result.charge.districtName} @ ${result.charge.validityFrom}`.trim() ||
        result.charge.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.charge);
});

app.delete('/api/financials/travelling-charges/:id', (req, res) => {
  const actor = requireFinancialsTravellingCharges(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteTravellingCharge(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('travellingChargeNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'travelling_charge',
    entityNumber:
      `${result.charge.customerAlias || result.charge.customerName}-${result.charge.districtAlias || result.charge.districtName} @ ${result.charge.validityFrom}`.trim() ||
      result.charge.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.charge);
});

app.get('/api/financials/stenotypist-bonus/candidates', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  res.json({ candidates: listBonusStenotypistCandidates(actor) });
});

app.get('/api/financials/stenotypist-bonus', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listBonusConfigurationRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-bonus/:id', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findBonusConfigurationRecordById(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('bonusConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.configuration);
});

app.post('/api/financials/stenotypist-bonus', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createBonusConfigurationRecord(req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'stenotypist_bonus',
    entityNumber:
      `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName} @ ${result.configuration.validFrom}`.trim() ||
      result.configuration.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(
      getStenotypistBonusAuditFieldMap(result.configuration),
    ),
  });

  res.status(201).json(result.configuration);
});

app.put('/api/financials/stenotypist-bonus/:id', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findBonusConfigurationRecordById(req.params.id, actor);
  const before = beforeResult.errors ? null : beforeResult.configuration;
  const result = updateBonusConfigurationRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('bonusConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getStenotypistBonusAuditFieldMap(before),
    getStenotypistBonusAuditFieldMap(result.configuration),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'stenotypist_bonus',
      entityNumber:
        `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName} @ ${result.configuration.validFrom}`.trim() ||
        result.configuration.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.configuration);
});

app.get('/api/financials/stenotypist-bonuses/candidates', (req, res) => {
  const actor = requireFinancialsStenotypistBonuses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listBonusesStenotypistCandidates(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-bonuses', (req, res) => {
  const actor = requireFinancialsStenotypistBonuses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listMonthlyBonusRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-penalty', (req, res) => {
  const actor = requireFinancialsStenotypistPenalty(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listPenaltyConfigurationRecords(actor, {
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-penalty/:id', (req, res) => {
  const actor = requireFinancialsStenotypistPenalty(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findPenaltyConfigurationRecordById(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('penaltyConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.configuration);
});

app.post('/api/financials/stenotypist-penalty', (req, res) => {
  const actor = requireFinancialsStenotypistPenalty(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createPenaltyConfigurationRecord(req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'stenotypist_penalty',
    entityNumber: result.configuration.validFrom || result.configuration.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(
      getStenotypistPenaltyAuditFieldMap(result.configuration),
    ),
  });

  res.status(201).json(result.configuration);
});

app.put('/api/financials/stenotypist-penalty/:id', (req, res) => {
  const actor = requireFinancialsStenotypistPenalty(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findPenaltyConfigurationRecordById(req.params.id, actor);
  const before = beforeResult.errors ? null : beforeResult.configuration;
  const result = updatePenaltyConfigurationRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('penaltyConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getStenotypistPenaltyAuditFieldMap(before),
    getStenotypistPenaltyAuditFieldMap(result.configuration),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'stenotypist_penalty',
      entityNumber: result.configuration.validFrom || result.configuration.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.configuration);
});

app.delete('/api/financials/stenotypist-penalty/:id', (req, res) => {
  const actor = requireFinancialsStenotypistPenalty(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deletePenaltyConfigurationRecord(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('penaltyConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'stenotypist_penalty',
    entityNumber: result.configuration.validFrom || result.configuration.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.configuration);
});

app.get('/api/financials/stenotypist-penalties/candidates', (req, res) => {
  const actor = requireFinancialsStenotypistPenalties(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listPenaltiesStenotypistCandidates(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-penalties', (req, res) => {
  const actor = requireFinancialsStenotypistPenalties(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listPenaltyRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/travel-expenses/candidates', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listTravelExpenseStenotypistCandidates(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/travel-expenses/resolve', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const amount = resolveTravelExpenseAmount(
    typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    typeof req.query.districtId === 'string' ? req.query.districtId : '',
    typeof req.query.jobDate === 'string' ? req.query.jobDate : '',
  );
  res.json({ amount });
});

app.get('/api/financials/travel-expenses', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listTravelExpenseRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    districtId: typeof req.query.districtId === 'string' ? req.query.districtId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/travel-expenses/:id', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findTravelExpenseRecordById(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('travelExpenseNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.configuration);
});

app.post('/api/financials/travel-expenses', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createTravelExpenseRecord(req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'travel_expense',
    entityNumber:
      `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName}-${result.configuration.districtAlias || result.configuration.districtName} @ ${result.configuration.validFrom}`.trim() ||
      result.configuration.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getTravelExpenseAuditFieldMap(result.configuration)),
  });

  res.status(201).json(result.configuration);
});

app.put('/api/financials/travel-expenses/:id', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findTravelExpenseRecordById(req.params.id, actor);
  const before = beforeResult.errors ? null : beforeResult.configuration;
  const result = updateTravelExpenseRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('travelExpenseNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getTravelExpenseAuditFieldMap(before),
    getTravelExpenseAuditFieldMap(result.configuration),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'travel_expense',
      entityNumber:
        `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName}-${result.configuration.districtAlias || result.configuration.districtName} @ ${result.configuration.validFrom}`.trim() ||
        result.configuration.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.configuration);
});

app.delete('/api/financials/travel-expenses/:id', (req, res) => {
  const actor = requireFinancialsTravelExpenses(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteTravelExpenseRecord(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('travelExpenseNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'travel_expense',
    entityNumber:
      `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName}-${result.configuration.districtAlias || result.configuration.districtName} @ ${result.configuration.validFrom}`.trim() ||
      result.configuration.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.configuration);
});

app.get('/api/financials/job-travel-expenses/candidates', (req, res) => {
  const actor = requireFinancialsTravelExpenseList(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listJobTravelExpenseStenotypistCandidates(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/job-travel-expenses', (req, res) => {
  const actor = requireFinancialsTravelExpenseList(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listJobTravelExpenseRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    status: typeof req.query.status === 'string' ? req.query.status : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/financials/job-travel-expenses/:jobId/approve', (req, res) => {
  const actor = requireFinancialsTravelExpenseList(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findJobTravelExpenseRecordByJobId(req.params.jobId, actor);
  const before = beforeResult.errors ? null : beforeResult.expense;
  const result = approveJobTravelExpense(req.params.jobId, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('jobTravelExpenseNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getJobTravelExpenseAuditFieldMap(before),
    getJobTravelExpenseAuditFieldMap(result.expense),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'job_travel_expense',
      entityNumber: result.expense.jobNumber || result.expense.jobId || req.params.jobId,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.expense);
});

app.post('/api/financials/job-travel-expenses/:jobId/reject', (req, res) => {
  const actor = requireFinancialsTravelExpenseList(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findJobTravelExpenseRecordByJobId(req.params.jobId, actor);
  const before = beforeResult.errors ? null : beforeResult.expense;
  const result = rejectJobTravelExpense(req.params.jobId, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('jobTravelExpenseNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getJobTravelExpenseAuditFieldMap(before),
    getJobTravelExpenseAuditFieldMap(result.expense),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'job_travel_expense',
      entityNumber: result.expense.jobNumber || result.expense.jobId || req.params.jobId,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.expense);
});

app.get('/api/financials/stenotypist-financials-report/candidates', (req, res) => {
  const actor = requireFinancialsStenotypistFinancialsReport(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listStenotypistFinancialsReportCandidates(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/stenotypist-financials-report', (req, res) => {
  const actor = requireFinancialsStenotypistFinancialsReport(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listStenotypistFinancialsReportRecords(actor, {
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.delete('/api/financials/stenotypist-bonus/:id', (req, res) => {
  const actor = requireFinancialsStenotypistBonus(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteBonusConfigurationRecord(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('bonusConfigurationNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'stenotypist_bonus',
    entityNumber:
      `${result.configuration.stenotypistUsername || result.configuration.stenotypistFullName} @ ${result.configuration.validFrom}`.trim() ||
      result.configuration.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.configuration);
});

app.get('/api/financials/reconciliation', (req, res) => {
  const actor = requireFinancialsReconciliation(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listJobReconciliationRecords(actor, {
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    jobStatus: typeof req.query.jobStatus === 'string' ? req.query.jobStatus : '',
    reconciliationStatus:
      typeof req.query.reconciliationStatus === 'string' ? req.query.reconciliationStatus : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json({ jobs: result.jobs });
});

app.get('/api/financials/reconciliation/:id', (req, res) => {
  const actor = requireFinancialsReconciliation(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findJobReconciliationRecord(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('jobNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/financials/reconciliation/:id/confirm', (req, res) => {
  const actor = requireFinancialsReconciliation(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = confirmJobReconciliation(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('jobNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.put('/api/financials/reconciliation/:id', (req, res) => {
  const actor = requireFinancialsReconciliation(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = updateJobReconciliation(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('jobNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

function requireFinancialsProformas(req, res) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  if (!canAccessCustomerInvoicingModule(user)) {
    res.status(403).json({ error: 'Forbidden.' });
    return null;
  }
  return user;
}

app.get('/api/financials/proformas', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listProformaRecords(actor, {
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    status: typeof req.query.status === 'string' ? req.query.status : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json({ proformas: result.proformas });
});

app.get('/api/financials/proformas/eligible-jobs', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listProformaEligibleJobs(actor, {
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    billingYear: typeof req.query.billingYear === 'string' ? req.query.billingYear : '',
    billingMonth: typeof req.query.billingMonth === 'string' ? req.query.billingMonth : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json({ jobs: result.jobs });
});

app.get('/api/financials/proformas/process', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listProformaProcessRecords(actor, {
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    jobStatus: typeof req.query.jobStatus === 'string' ? req.query.jobStatus : '',
    type: typeof req.query.type === 'string' ? req.query.type : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/financials/proformas/process/generate', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const body = req.body ?? {};
  const result = generateProformasFromProcess(actor, {
    dateFrom: typeof body.dateFrom === 'string' ? body.dateFrom : '',
    dateTo: typeof body.dateTo === 'string' ? body.dateTo : '',
    customerId: typeof body.customerId === 'string' ? body.customerId : '',
    stenotypistUserId:
      typeof body.stenotypistUserId === 'string' ? body.stenotypistUserId : '',
    jobStatus: typeof body.jobStatus === 'string' ? body.jobStatus : '',
    type: typeof body.type === 'string' ? body.type : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  for (const row of result.proformas ?? []) {
    const lookup = findProformaById(row.id, actor);
    const proforma = lookup.errors ? null : lookup.proforma;
    if (!proforma) continue;
    const entityNumber = proforma.proformaNumber || proforma.id;
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'proforma',
      entityNumber,
      entryType: 'created',
      entryDetails: buildCreatedDetailsFromMap(getProformaAuditFieldMap(proforma)),
    });
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'proforma',
      entityNumber,
      entryType: 'exported',
      entryDetails: buildCreatedDetailsFromMap(getProformaAuditFieldMap(proforma)),
    });
  }

  res.status(201).json(result);
});

app.get('/api/financials/priority-erp/import-procedure', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  res.json(getPriorityErpImportProcedureSpec());
});

app.post('/api/financials/priority-erp/validate-import', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const body = req.body ?? {};
  const content = typeof body.content === 'string' ? body.content : '';
  const format = body.format === 'csv' ? 'csv' : 'json';

  if (!content.trim()) {
    res.status(400).json({ errors: ['priorityErpImportInvalidFormat'] });
    return;
  }

  const result = validatePriorityErpImportFile({ content, format });
  if (!result.valid) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

app.get('/api/financials/priority-erp/exports/:id', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const record = findPriorityErpExportById(req.params.id);
  if (!record) {
    res.status(404).json({ errors: ['priorityErpExportNotFound'] });
    return;
  }

  res.json({
    export: record,
    download: {
      json: `/api/financials/priority-erp/exports/${record.id}/download?format=json`,
      csv: `/api/financials/priority-erp/exports/${record.id}/download?format=csv`,
    },
  });
});

app.get('/api/financials/priority-erp/exports/:id/download', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const exportId = req.params.id;
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const record = findPriorityErpExportById(exportId);
  if (!record) {
    res.status(404).json({ errors: ['priorityErpExportNotFound'] });
    return;
  }

  const content = getPriorityErpExportDownloadContent(exportId, format);
  if (!content) {
    res.status(404).json({ errors: ['priorityErpExportFileNotFound'] });
    return;
  }

  const filename = getPriorityErpExportDownloadFilename(exportId, format);
  res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  res.send(content);
});

app.get('/api/financials/proformas/:id', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findProformaById(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.proforma);
});

app.get('/api/financials/proformas/:id/items', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findProformaItems(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/financials/proformas/:id/tracking', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = getProformaTrackingSummary(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/financials/proformas', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createProformaRecord(req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'proforma',
    entityNumber: result.proforma?.proformaNumber || result.proforma?.id || '',
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getProformaAuditFieldMap(result.proforma)),
  });

  res.status(201).json(result);
});

app.post('/api/financials/proformas/:id/post', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = postProformaToPriorityErp(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'proforma',
    entityNumber: result.proforma.proformaNumber || result.proforma.id,
    entryType: 'exported',
    entryDetails: buildCreatedDetailsFromMap(getProformaAuditFieldMap(result.proforma)),
  });

  res.json(result.proforma);
});

app.post('/api/financials/proformas/:id/void', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = voidProformaRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'proforma',
    entityNumber: result.proforma.proformaNumber || result.proforma.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.proforma);
});

app.post('/api/financials/proformas/:id/repost', (req, res) => {
  const actor = requireFinancialsProformas(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = findProformaById(req.params.id, actor);
  const before = beforeResult.errors ? null : beforeResult.proforma;
  const result = repostProformaRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('proformaNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'financials',
    entityName: 'proforma',
    entityNumber: result.proforma?.proformaNumber || result.proforma?.id || '',
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getProformaAuditFieldMap(result.proforma)),
  });

  const afterOriginal = findProformaById(req.params.id, actor);
  const fieldChanges = buildUpdatedDetailsFromMaps(
    getProformaAuditFieldMap(before),
    getProformaAuditFieldMap(afterOriginal.errors ? null : afterOriginal.proforma),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'financials',
      entityName: 'proforma',
      entityNumber: before?.proformaNumber || before?.id || req.params.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.status(201).json(result);
});

app.get('/api/scheduling/job-matrix', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const centerDate =
    typeof req.query.centerDate === 'string' ? req.query.centerDate : '';
  const result = getJobMatrix(centerDate);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/scheduling/reports/stenotypist-summary', (req, res) => {
  const actor = requireSchedulingReports(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const centerDate =
    typeof req.query.centerDate === 'string' ? req.query.centerDate : '';
  const result = getStenotypistSummaryReport(centerDate);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/scheduling/reports/stenotypist-assignments-per-district', (req, res) => {
  const actor = requireSchedulingReports(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = getStenotypistAssignmentsPerDistrictReport({
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    page: typeof req.query.page === 'string' ? req.query.page : '1',
    pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : '50',
    sortDirection: typeof req.query.sortDirection === 'string' ? req.query.sortDirection : 'asc',
  });
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/transcripts', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = queryTranscriptList(actor, {
    type: typeof req.query.type === 'string' ? req.query.type : '',
    jobStatus:
      typeof req.query.jobStatus === 'string'
        ? req.query.jobStatus
        : typeof req.query.status === 'string'
          ? req.query.status
          : '',
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    projectId: typeof req.query.projectId === 'string' ? req.query.projectId : '',
    stenotypistUserId:
      typeof req.query.stenotypistUserId === 'string' ? req.query.stenotypistUserId : '',
    editorUserId: typeof req.query.editorUserId === 'string' ? req.query.editorUserId : '',
    reviewerUserId: typeof req.query.reviewerUserId === 'string' ? req.query.reviewerUserId : '',
    transcriptOwnerUserId:
      typeof req.query.transcriptOwnerUserId === 'string' ? req.query.transcriptOwnerUserId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    search: typeof req.query.search === 'string' ? req.query.search : '',
    sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : '',
    sortDirection: typeof req.query.sortDirection === 'string' ? req.query.sortDirection : '',
    page: typeof req.query.page === 'string' ? req.query.page : '1',
    pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : '20',
  });

  res.json(result);
});

app.get('/api/transcripts/analysis-report', (req, res) => {
  const actor = requireTranscriptsAnalysisReport(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = buildTranscriptsAnalysisReport(actor, {
    jobStatus:
      typeof req.query.jobStatus === 'string'
        ? req.query.jobStatus
        : typeof req.query.status === 'string'
          ? req.query.status
          : '',
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : '',
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    search: typeof req.query.search === 'string' ? req.query.search : '',
  });

  res.json(result);
});

app.get('/api/transcripts/options/participants', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  res.json({
    participants: listTranscriptParticipantCandidates(),
    publishers: listTranscriptPublisherCandidates(),
  });
});

app.get('/api/transcripts/:id/report', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = buildTranscriptReport(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/transcripts/:id/file-list', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = getTranscriptFilesList(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/transcripts/:id/files/download', async (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const slot = typeof req.query.slot === 'string' ? req.query.slot : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  const result = await getTranscriptFileDownload(req.params.id, slot, fileId, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptFileNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const transcript = findTranscriptRecordById(req.params.id);
  recordAuditEntry({
    actor,
    module: 'transcripts',
    entityName: 'transcript',
    entityNumber: transcript?.jobNumber || transcript?.id || req.params.id,
    entryType: 'downloaded',
    entryDetails: buildFileTransferEntryDetails({
      fileSize: formatFileSizeBytes(result.buffer?.length),
      duration: '',
    }),
  });

  res.setHeader('Content-Type', result.type);
  res.setHeader('Content-Disposition', `attachment; filename="${result.name.replace(/"/g, '')}"`);
  res.send(result.buffer);
});

app.get('/api/transcripts/:id/files/history', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const slot = typeof req.query.slot === 'string' ? req.query.slot : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  const result = getTranscriptFileHistory(req.params.id, slot, fileId, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptFileNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/transcripts/:id/files', express.json({ limit: '25mb' }), (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = addTranscriptOtherFile(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.put('/api/transcripts/:id/files', express.json({ limit: '25mb' }), (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = updateTranscriptFile(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/transcripts/:id', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = getTranscriptForActor(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.transcript);
});

app.put('/api/transcripts/:id', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findTranscriptRecordById(req.params.id);
  const result = updateTranscriptRecord(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getTranscriptAuditFieldMap(before),
    getTranscriptAuditFieldMap(result.transcript),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'transcripts',
      entityName: 'transcript',
      entityNumber: result.transcript?.jobNumber || result.transcript?.id || req.params.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result);
});

app.post('/api/transcripts/:id/workflow/edited', express.json({ limit: '25mb' }), (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = submitEditedTranscript(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }
  res.json(result);
});

app.post('/api/transcripts/:id/workflow/reviewed', express.json({ limit: '25mb' }), (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = submitReviewedTranscript(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }
  res.json(result);
});

app.post('/api/transcripts/:id/workflow/publish', (req, res) => {
  const actor = requireTranscripts(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = publishTranscript(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('transcriptNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }
  res.json(result);
});

app.get('/api/scheduling/stenotypists/:id/info-panel', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const period = typeof req.query.period === 'string' ? req.query.period : 'current_month';
  const centerDate = typeof req.query.centerDate === 'string' ? req.query.centerDate : '';
  const result = getStenotypistInfoPanel(req.params.id, { period, centerDate });
  if (result.errors) {
    const status = result.errors.includes('stenotypistInfoUserNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/scheduling/jobs/options', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({
    ...getJobCatalog(),
    reconciliationStatuses: JOB_RECONCILIATION_STATUS_OPTIONS,
    rejectionReasons: JOB_REJECTION_REASON_OPTIONS,
    travellingChargesOptions: TRAVELLING_CHARGES_OPTIONS,
  });
});

app.get('/api/scheduling/jobs/stenotypist-candidates', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ stenotypists: listJobStenotypistCandidates() });
});

app.get('/api/scheduling/jobs/records', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ jobs: listJobRecords(actor) });
});

app.get('/api/scheduling/jobs/records/:id', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const job = findJobRecordById(req.params.id);
  if (!job || !canAccessJobRecord(job, actor)) {
    res.status(404).json({ errors: ['jobNotFound'] });
    return;
  }

  res.json(job);
});

app.post('/api/scheduling/jobs/records', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createJob(req.body ?? {}, actor);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'job',
    entityNumber: result.job.jobNumber || result.job.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getJobAuditFieldMap(result.job)),
  });

  res.status(201).json(result.job);
});

app.put('/api/scheduling/jobs/records/:id', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findJobRecordById(req.params.id);
  const result = updateJob(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getJobAuditFieldMap(before),
    getJobAuditFieldMap(result.job),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'job',
      entityNumber: result.job.jobNumber || result.job.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.job);
});

app.get('/api/scheduling/jobs/records/:id/submission', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = getJobSubmission(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 403;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.submission);
});

app.put('/api/scheduling/jobs/records/:id/submission', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = getJobSubmission(req.params.id, actor);
  const beforeSubmission = beforeResult.errors ? null : beforeResult.submission;
  const result = saveJobSubmission(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const job = findJobRecordById(req.params.id);
  recordJobSubmissionChangeEntries({
    actor,
    job,
    beforeSubmission,
    afterSubmission: result.submission,
  });

  res.json(result.submission);
});

app.post('/api/scheduling/jobs/records/:id/submission/complete', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const beforeResult = getJobSubmission(req.params.id, actor);
  const beforeSubmission = beforeResult.errors ? null : beforeResult.submission;
  const beforeJob = findJobRecordById(req.params.id);
  const result = completeJobSubmission(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const job = result.job || findJobRecordById(req.params.id);
  recordJobSubmissionChangeEntries({
    actor,
    job,
    beforeSubmission,
    afterSubmission: result.submission,
  });

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getJobAuditFieldMap(beforeJob),
    getJobAuditFieldMap(job),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'scheduling',
      entityName: 'job',
      entityNumber: job?.jobNumber || job?.id || req.params.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  if (result.transcript) {
    recordAuditEntry({
      actor,
      module: 'transcripts',
      entityName: 'transcript',
      entityNumber: result.transcript.jobNumber || result.transcript.id,
      entryType: 'created',
      entryDetails: buildCreatedDetailsFromMap(getTranscriptAuditFieldMap(result.transcript)),
    });
  }

  res.json(result);
});

app.post('/api/scheduling/jobs/records/confirm-all', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = confirmAllPendingJobs(actor);
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.post('/api/scheduling/jobs/records/:id/approve', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = approveJob(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/scheduling/jobs/records/:id/reject', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = rejectJob(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/scheduling/jobs/records/:id/assign', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = assignJob(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/scheduling/jobs/records/:id/matrix-allocate', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = matrixAllocateJob(req.params.id, req.body ?? {}, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/scheduling/jobs/records/:id/matrix-unassign', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = matrixUnassignJob(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.post('/api/scheduling/jobs/records/:id/confirm', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = confirmJob(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.job);
});

app.delete('/api/scheduling/jobs/records/:id', (req, res) => {
  const actor = requireSchedulingJobs(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteJob(req.params.id, actor);
  if (result.errors) {
    const status = result.errors.includes('jobNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  recordAuditEntry({
    actor,
    module: 'scheduling',
    entityName: 'job',
    entityNumber: result.job.jobNumber || result.job.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.job);
});

app.get('/api/projects/records', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ projects: listProjectRecords() });
});

app.get('/api/projects/transcript-owner-candidates', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : '';
  const excludeRaw = typeof req.query.exclude === 'string' ? req.query.exclude : '';
  const excludeUserIds = excludeRaw
    ? excludeRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  const result = listTranscriptOwnerCandidates(customerId, { excludeUserIds });
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  res.json({ candidates: result.candidates });
});

app.get('/api/projects/records/:id', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const project = findProjectRecordById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  res.json(project);
});

app.post('/api/projects/records', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createProject(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'project_created',
    message: `Project ${result.project.projectNumber} was created.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'project',
    entityNumber: result.project.projectNumber || result.project.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getProjectAuditFieldMap(result.project)),
  });
  recordProjectTranscriptOwnerChangeEntries({
    actor,
    project: result.project,
    beforeProject: null,
    afterProject: result.project,
  });

  res.status(201).json(result.project);
});

app.put('/api/projects/records/:id', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findProjectRecordById(req.params.id);
  const result = updateProject(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('projectNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'project_updated',
    message: `Project ${result.project.projectNumber} was updated.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getProjectAuditFieldMap(before),
    getProjectAuditFieldMap(result.project),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'project',
      entityNumber: result.project.projectNumber || result.project.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  recordProjectTranscriptOwnerChangeEntries({
    actor,
    project: result.project,
    beforeProject: before,
    afterProject: result.project,
  });

  res.json(result.project);
});

app.patch('/api/projects/records/:id/status', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findProjectRecordById(req.params.id);
  const result = updateProjectStatus(req.params.id, req.body?.status);
  if (result.errors) {
    const status = result.errors.includes('projectNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(
    getProjectAuditFieldMap(before),
    getProjectAuditFieldMap(result.project),
  );
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'project',
      entityNumber: result.project.projectNumber || result.project.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  res.json(result.project);
});

app.delete('/api/projects/records/:id', (req, res) => {
  const actor = requireProjectsRecords(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteProject(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('projectNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'project_deleted',
    message: `Project ${result.project.projectNumber} was deleted.`,
    targetUserId: null,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'projects',
    entityName: 'project',
    entityNumber: result.project.projectNumber || result.project.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json(result.project);
});

app.get('/api/users', (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ users: listUsers() });
});

app.get('/api/users/:id', (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const user = findUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(toPublicUser(user));
});

app.post('/api/users', async (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createUser(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'user_created',
    message: `User ${result.user.fullName} was created.`,
    targetUserId: result.user.id,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'administration',
    entityName: 'user',
    entityNumber: result.user.username || result.user.id,
    entryType: 'created',
    entryDetails: buildCreatedDetailsFromMap(getUserAuditFieldMap(result.user)),
  });
  recordUserRoleChangeEntries({
    actor,
    user: result.user,
    beforeUser: null,
    afterUser: result.user,
  });

  // Welcome + MFA QR / setup key email (secrets stay off the HTTP response).
  try {
    await sendUserEnrollmentEmail({
      user: result.user,
      totpSecret: result.enrollment?.totpSecret,
      temporaryPassword: result.enrollment?.temporaryPassword,
    });
  } catch (error) {
    console.error('[user_created] Enrollment email failed:', error);
  }

  res.status(201).json(result.user);
});

app.put('/api/users/:id', (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findUserById(req.params.id);
  const beforePublic = before ? toPublicUser(before) : null;
  const result = updateUser(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('userNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'user_updated',
    message: `User ${result.user.fullName} was updated.`,
    targetUserId: result.user.id,
    createdByUserId: actor.id,
  });

  const beforeMap = getUserAuditFieldMap(beforePublic);
  const afterMap = getUserAuditFieldMap(result.user);
  const passwordProvided =
    typeof req.body?.password === 'string' && req.body.password.trim().length > 0;
  if (passwordProvided) {
    afterMap.Password = 'Changed';
    beforeMap.Password = '';
  }

  const fieldChanges = buildUpdatedDetailsFromMaps(beforeMap, afterMap);
  if ((fieldChanges.fields ?? []).length > 0) {
    recordAuditEntry({
      actor,
      module: 'administration',
      entityName: 'user',
      entityNumber: result.user.username || result.user.id,
      entryType: 'updated',
      entryDetails: fieldChanges,
    });
  }

  recordUserRoleChangeEntries({
    actor,
    user: result.user,
    beforeUser: beforePublic,
    afterUser: result.user,
  });

  res.json(result.user);
});

app.patch('/api/users/:id/status', (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const before = findUserById(req.params.id);
  const beforePublic = before ? toPublicUser(before) : null;
  const status = req.body?.status;
  const updated = updateUserStatus(req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  createNotification({
    type: 'user_status_changed',
    message: `User ${updated.fullName} is now ${updated.status}.`,
    targetUserId: updated.id,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'administration',
    entityName: 'user',
    entityNumber: updated.username || updated.id,
    entryType: 'updated',
    entryDetails: buildUpdatedDetailsFromMaps(
      getUserAuditFieldMap(beforePublic),
      getUserAuditFieldMap(updated),
    ),
  });

  res.json(updated);
});

app.delete('/api/users/:id', (req, res) => {
  const actor = requireAdminUsers(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  if (actor.id === req.params.id) {
    res.status(400).json({ errors: ['cannotDeleteSelf'] });
    return;
  }

  const result = deleteUser(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('userNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'user_deleted',
    message: `User ${result.user.fullName} was deleted.`,
    targetUserId: result.user.id,
    createdByUserId: actor.id,
  });

  recordAuditEntry({
    actor,
    module: 'administration',
    entityName: 'user',
    entityNumber: result.user.username || result.user.id,
    entryType: 'deleted',
    entryDetails: buildEmptyEntryDetails(),
  });

  res.json({ success: true, user: result.user });
});

app.get('/api/administration/audit-trail/options', (req, res) => {
  const actor = requireAuditTrail(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listAuditTrailFilterOptions(actor);
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/administration/audit-trail', (req, res) => {
  const actor = requireAuditTrail(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = listAuditTrailRecords(actor, {
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '',
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : '',
    userId: typeof req.query.userId === 'string' ? req.query.userId : '',
    module: typeof req.query.module === 'string' ? req.query.module : '',
    entityName: typeof req.query.entityName === 'string' ? req.query.entityName : '',
    entityNumber: typeof req.query.entityNumber === 'string' ? req.query.entityNumber : '',
    entryType: typeof req.query.entryType === 'string' ? req.query.entryType : '',
  });
  if (result.errors) {
    const status = result.errors.includes('forbidden') ? 403 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result);
});

app.get('/api/administration/audit-trail/:id', (req, res) => {
  const actor = requireAuditTrail(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = findAuditTrailRecordById(actor, req.params.id);
  if (result.errors) {
    const status = result.errors.includes('forbidden')
      ? 403
      : result.errors.includes('auditTrailEntryNotFound')
        ? 404
        : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  res.json(result.entry);
});

app.get('/api/stenotypist-assets', (req, res) => {
  const actor = requireStenotypistAssets(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;
  res.json({ assets: listStenotypistAssets() });
});

app.get('/api/stenotypist-assets/:id', (req, res) => {
  const actor = requireStenotypistAssets(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const asset = findStenotypistAssetById(req.params.id);
  if (!asset) {
    res.status(404).json({ error: 'Stenotypist asset not found.' });
    return;
  }

  res.json(asset);
});

app.post('/api/stenotypist-assets', (req, res) => {
  const actor = requireStenotypistAssets(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = createStenotypistAsset(req.body ?? {});
  if (result.errors) {
    res.status(400).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'stenotypist_asset_created',
    message: `Stenotypist assets recorded for ${result.asset.stenotypistName}.`,
    targetUserId: result.asset.stenotypistId,
    createdByUserId: actor.id,
  });

  res.status(201).json(result.asset);
});

app.put('/api/stenotypist-assets/:id', (req, res) => {
  const actor = requireStenotypistAssets(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = updateStenotypistAsset(req.params.id, req.body ?? {});
  if (result.errors) {
    const status = result.errors.includes('stenotypistAssetNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  createNotification({
    type: 'stenotypist_asset_updated',
    message: `Stenotypist assets updated for ${result.asset.stenotypistName}.`,
    targetUserId: result.asset.stenotypistId,
    createdByUserId: actor.id,
  });

  res.json(result.asset);
});

app.delete('/api/stenotypist-assets/:id', (req, res) => {
  const actor = requireStenotypistAssets(req, res);
  if (!actor) return;
  if (rejectIfPasswordChangeRequired(actor, res)) return;

  const result = deleteStenotypistAsset(req.params.id);
  if (result.errors) {
    const status = result.errors.includes('stenotypistAssetNotFound') ? 404 : 400;
    res.status(status).json({ errors: result.errors });
    return;
  }

  if (result.asset) {
    createNotification({
      type: 'stenotypist_asset_deleted',
      message: `Stenotypist assets removed for ${result.asset.stenotypistName}.`,
      targetUserId: result.asset.stenotypistId,
      createdByUserId: actor.id,
    });
  }

  res.json({ success: true, asset: result.asset });
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
}
