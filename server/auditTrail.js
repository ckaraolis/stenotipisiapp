import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUserById, listUsers } from './db.js';
import { hasPermission } from './permissions.js';

const AUDIT_TRAIL_PATH = path.join(__dirname, '..', 'database', 'auditTrail.json');

export const AUDIT_MODULES = [
  'scheduling',
  'transcripts',
  'projects',
  'financials',
  'administration',
  'dashboard',
];

export const AUDIT_ENTITY_NAMES = [
  'job',
  'job_allocation',
  'stenotypist_leave',
  'public_holiday',
  'travelling_time',
  'transcript',
  'customer',
  'project',
  'district',
  'travelling_charge',
  'job_reconciliation',
  'proforma',
  'stenotypist_bonus',
  'stenotypist_penalty',
  'travel_expense',
  'job_travel_expense',
  'user',
  'stenotypist_asset',
  'notification',
  'account',
  'program_access',
  'customer_fields',
];

export const AUDIT_ENTRY_TYPES = [
  'created',
  'updated',
  'deleted',
  'downloaded',
  'uploaded',
  'exported',
  'role_assigned',
  'role_unassigned',
  'transcript_owner_added',
  'transcript_owner_removed',
  'raw_files_uploaded',
  'attachments_uploaded',
  'other_files_uploaded',
  'same_day_actions_updated',
  'session_opened',
  'session_closed',
];

function readAuditTrailFile() {
  ensureCollectionFile('auditTrail', { entries: [] });
  return readCollection('auditTrail', { entries: [] });
}

function writeAuditTrailFile(data) {
  writeCollection('auditTrail', data);
}

export function ensureAuditTrailDatabase() {
  ensureCollectionFile('auditTrail', { entries: [] });
}

function generateAuditEntryId() {
  return `at-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function assertAuditTrailAccess(actor) {
  if (!hasPermission(actor, 'administration.audit_trail')) {
    return { errors: ['forbidden'] };
  }
  return null;
}

function toPublicAuditEntry(entry) {
  const user = findUserById(entry.userId);
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId ?? '',
    userFullName: user?.fullName ?? entry.userFullName ?? '',
    userUsername: user?.username ?? entry.userUsername ?? '',
    module: entry.module ?? '',
    entityName: entry.entityName ?? '',
    entityNumber: entry.entityNumber ?? '',
    entryType: entry.entryType ?? '',
    entryDetails: entry.entryDetails ?? '',
  };
}

function formatAuditDataValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function valuesEqual(left, right) {
  return formatAuditDataValue(left) === formatAuditDataValue(right);
}

/** §1.5.1 — Created: Data Label + Data for all entity fields. */
export function buildCreatedEntryDetails(fields = []) {
  return {
    fields: (Array.isArray(fields) ? fields : [])
      .filter((field) => field && typeof field.label === 'string' && field.label.trim())
      .map((field) => ({
        label: field.label.trim(),
        data: formatAuditDataValue(field.data),
      })),
  };
}

/** §1.5.2 — Updated: Data Label + Old Data + New Data for modified fields only. */
export function buildUpdatedEntryDetails(fields = []) {
  return {
    fields: (Array.isArray(fields) ? fields : [])
      .filter((field) => field && typeof field.label === 'string' && field.label.trim())
      .map((field) => ({
        label: field.label.trim(),
        oldData: formatAuditDataValue(field.oldData),
        newData: formatAuditDataValue(field.newData),
      })),
  };
}

/** §1.5.3 / §1.5.7 — Deleted and Session Closed store no Entry Details. */
export function buildEmptyEntryDetails() {
  return '';
}

/** §1.5.4 / §1.5.5 — Uploaded / Downloaded: File Size + Duration. */
export function buildFileTransferEntryDetails({ fileSize = '', duration = '' } = {}) {
  return {
    fileSize: formatAuditDataValue(fileSize),
    duration: formatAuditDataValue(duration),
  };
}

/** §1.5.6 — Session Opened: User Agent String. */
export function buildSessionOpenedEntryDetails(userAgentString = '') {
  return {
    userAgentString: formatAuditDataValue(userAgentString),
  };
}

/** Build Created details from a label→value map. */
export function buildCreatedDetailsFromMap(fieldMap = {}) {
  return buildCreatedEntryDetails(
    Object.entries(fieldMap).map(([label, data]) => ({ label, data })),
  );
}

/** Build Updated details by comparing before/after maps (same labels). */
export function buildUpdatedDetailsFromMaps(beforeMap = {}, afterMap = {}) {
  const labels = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
  const fields = [];
  for (const label of labels) {
    const oldData = beforeMap[label];
    const newData = afterMap[label];
    if (valuesEqual(oldData, newData)) continue;
    fields.push({ label, oldData, newData });
  }
  return buildUpdatedEntryDetails(fields);
}

/** Safe public snapshot for User entity audits (no secrets). */
export function getUserAuditFieldMap(user, { includeRoles = false } = {}) {
  if (!user) return {};
  const map = {
    'Full Name': user.fullName ?? '',
    Username: user.username ?? '',
    Email: user.email ?? '',
    'Contact Phone': user.contactPhone ?? '',
    'Mobile Phone': user.mobilePhone ?? '',
    Language: user.language ?? '',
    Status: user.status ?? '',
    Customer: user.customerName ?? user.customerId ?? '',
  };
  if (includeRoles) {
    map.Roles = Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [];
  }
  return map;
}

function normalizeRoleList(userOrRoles) {
  if (Array.isArray(userOrRoles)) {
    return [...new Set(userOrRoles.map((role) => String(role ?? '').trim()).filter(Boolean))];
  }
  if (userOrRoles && typeof userOrRoles === 'object') {
    if (Array.isArray(userOrRoles.roles)) {
      return normalizeRoleList(userOrRoles.roles);
    }
    if (userOrRoles.role) {
      return normalizeRoleList([userOrRoles.role]);
    }
  }
  return [];
}

/** §2.1 — Diff roles for Role Assigned / Role Unassigned entries. */
export function getUserRoleDiff(beforeUser, afterUser) {
  const before = new Set(normalizeRoleList(beforeUser));
  const after = new Set(normalizeRoleList(afterUser));
  return {
    assigned: [...after].filter((role) => !before.has(role)).sort(),
    unassigned: [...before].filter((role) => !after.has(role)).sort(),
  };
}

/** §2.1 — Role Assigned / Role Unassigned details (Created-style: Role + value). */
export function buildRoleChangeEntryDetails(role) {
  return buildCreatedEntryDetails([{ label: 'Role', data: role }]);
}

/**
 * §2.1 — Record User role assignment/unassignment entries.
 * Returns the number of role audit entries written.
 */
export function recordUserRoleChangeEntries({
  actor,
  user,
  beforeUser = null,
  afterUser = null,
} = {}) {
  const target = afterUser ?? user;
  const entityNumber = target?.username || target?.id || user?.username || user?.id || '';
  const { assigned, unassigned } = getUserRoleDiff(beforeUser, afterUser ?? user);
  let count = 0;

  for (const role of assigned) {
    recordAuditEntry({
      actor,
      module: 'administration',
      entityName: 'user',
      entityNumber,
      entryType: 'role_assigned',
      entryDetails: buildRoleChangeEntryDetails(role),
    });
    count += 1;
  }

  for (const role of unassigned) {
    recordAuditEntry({
      actor,
      module: 'administration',
      entityName: 'user',
      entityNumber,
      entryType: 'role_unassigned',
      entryDetails: buildRoleChangeEntryDetails(role),
    });
    count += 1;
  }

  return count;
}

/** §2.2 — Customer entity audit snapshot. */
export function getCustomerAuditFieldMap(customer) {
  if (!customer) return {};
  return {
    'Customer Number': customer.customerNumber ?? '',
    Name: customer.name ?? '',
    Alias: customer.alias ?? '',
    'Contact Person': customer.contactPerson ?? '',
    'Contact Phone': customer.contactPhone ?? '',
    'Contact Email': customer.contactEmail ?? '',
    'Priority ERP Number': customer.priorityErpNumber ?? '',
    'Hourly Rate': customer.hourlyRate ?? '',
    SLA: customer.sla ?? '',
    'Travelling Charges': customer.travellingCharges ?? '',
    Remarks: customer.remarks ?? '',
    'Field 1 Status': customer.field1Status ?? '',
    'Field 1 Name': customer.field1Name ?? '',
    'Field 2 Status': customer.field2Status ?? '',
    'Field 2 Name': customer.field2Name ?? '',
    'Field 3 Status': customer.field3Status ?? '',
    'Field 3 Name': customer.field3Name ?? '',
    'Field 4 Status': customer.field4Status ?? '',
    'Field 4 Name': customer.field4Name ?? '',
    Enabled: customer.enabled !== false,
  };
}

/** §2.2 — Customer Fields entity audit snapshot. */
export function getCustomerFieldAuditFieldMap(fieldValue, customer = null) {
  if (!fieldValue) return {};
  const fieldRef = fieldValue.fieldReference;
  const fieldName =
    customer && fieldRef ? customer[`field${fieldRef}Name`] : '';
  return {
    Customer: customer?.name || customer?.customerNumber || fieldValue.customerId || '',
    Field: fieldName
      ? `Field ${fieldRef} (${fieldName})`
      : fieldRef
        ? `Field ${fieldRef}`
        : '',
    Value: fieldValue.value ?? '',
    Order: fieldValue.order ?? '',
  };
}

/** §2.2 — Project entity audit snapshot (owners handled separately). */
export function getProjectAuditFieldMap(project) {
  if (!project) return {};
  const field1Label = project.field1Name?.trim() || 'Field 1';
  const field2Label = project.field2Name?.trim() || 'Field 2';
  const field3Label = project.field3Name?.trim() || 'Field 3';
  const field4Label = project.field4Name?.trim() || 'Field 4';
  return {
    'Project Number': project.projectNumber ?? '',
    Customer: project.customerName || project.customerAlias || project.customerId || '',
    District: project.districtName || project.districtAlias || project.districtId || '',
    [field1Label]: project.field1Value ?? '',
    [field2Label]: project.field2Value ?? '',
    [field3Label]: project.field3 ?? '',
    [field4Label]: project.field4 ?? '',
    'Travelling Charges': project.travellingCharges ?? '',
    Status: project.status ?? '',
  };
}

function normalizeTranscriptOwners(project) {
  if (!project) return [];
  if (Array.isArray(project.transcriptOwners) && project.transcriptOwners.length > 0) {
    return project.transcriptOwners.map((owner) => ({
      id: owner.id ?? '',
      fullName: owner.fullName ?? '',
      username: owner.username ?? '',
      email: owner.email ?? '',
    }));
  }
  if (Array.isArray(project.transcriptOwnerIds)) {
    return project.transcriptOwnerIds.map((id) => ({
      id,
      fullName: '',
      username: '',
      email: '',
    }));
  }
  return [];
}

/** §2.2 — Transcript Owner Added/Removed details. */
export function buildTranscriptOwnerChangeEntryDetails(owner) {
  return buildCreatedEntryDetails([
    { label: 'Full Name', data: owner?.fullName ?? '' },
    { label: 'Username', data: owner?.username ?? '' },
    { label: 'Email', data: owner?.email ?? '' },
  ]);
}

/**
 * §2.2 — Record Project transcript owner add/remove entries.
 */
export function recordProjectTranscriptOwnerChangeEntries({
  actor,
  project,
  beforeProject = null,
  afterProject = null,
} = {}) {
  const target = afterProject ?? project;
  const entityNumber = target?.projectNumber || target?.id || project?.projectNumber || '';
  const beforeOwners = normalizeTranscriptOwners(beforeProject);
  const afterOwners = normalizeTranscriptOwners(afterProject ?? project);
  const beforeById = new Map(beforeOwners.map((owner) => [owner.id, owner]));
  const afterById = new Map(afterOwners.map((owner) => [owner.id, owner]));
  let count = 0;

  for (const [id, owner] of afterById) {
    if (beforeById.has(id)) continue;
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'project',
      entityNumber,
      entryType: 'transcript_owner_added',
      entryDetails: buildTranscriptOwnerChangeEntryDetails(owner),
    });
    count += 1;
  }

  for (const [id, owner] of beforeById) {
    if (afterById.has(id)) continue;
    recordAuditEntry({
      actor,
      module: 'projects',
      entityName: 'project',
      entityNumber,
      entryType: 'transcript_owner_removed',
      entryDetails: buildTranscriptOwnerChangeEntryDetails(owner),
    });
    count += 1;
  }

  return count;
}

/** §2.3 — Public Holiday audit snapshot. */
export function getPublicHolidayAuditFieldMap(holiday) {
  if (!holiday) return {};
  return {
    Name: holiday.name ?? '',
    Date: holiday.date ?? '',
  };
}

/** §2.3 — Stenotypist Leave audit snapshot. */
export function getStenotypistLeaveAuditFieldMap(leave) {
  if (!leave) return {};
  return {
    Stenotypist: leave.stenotypistName || leave.stenotypistUsername || leave.stenotypistUserId || '',
    Username: leave.stenotypistUsername ?? '',
    'Date From': leave.dateFrom ?? '',
    'Date To': leave.dateTo ?? '',
    Reason: leave.reason ?? '',
    Status: leave.status ?? '',
  };
}

/** §2.3 — Travelling Time audit snapshot (spec: Travelling Type). */
export function getTravellingTimeAuditFieldMap(trip) {
  if (!trip) return {};
  return {
    'District 1': trip.district1Name || trip.district1Alias || trip.district1Id || '',
    'District 2': trip.district2Name || trip.district2Alias || trip.district2Id || '',
    'Travelling Time (minutes)': trip.travellingTime ?? '',
    'Validity From': trip.validityFrom ?? '',
  };
}

/** §2.3 — Job audit snapshot. */
export function getJobAuditFieldMap(job) {
  if (!job) return {};
  return {
    'Job Number': job.jobNumber ?? '',
    Customer: job.customerName || job.customerAlias || '',
    Project: job.projectNumber || job.projectId || '',
    Date: job.date ?? '',
    Time: job.time ?? '',
    District: job.districtName || job.districtAlias || '',
    Stenotypist: job.stenotypistName || job.stenotypistUsername || '',
    'Location Details': job.locationDetails ?? '',
    Status: job.status ?? '',
    Remarks: job.remarks ?? '',
    Expedite: job.expedite ?? '',
    'Rejection Reason': job.rejectionReason ?? '',
    'Receipt Number (Stenotypist)': job.receiptNumberStenotypist ?? '',
    'Start Time (Stenotypist)': job.startTimeStenotypist ?? '',
    'End Time (Stenotypist)': job.endTimeStenotypist ?? '',
    'Travelling Charges (System)': job.travellingChargesSystem ?? '',
    'Receipt Number (Administrator)': job.receiptNumberAdministrator ?? '',
    'Start Time (Administrator)': job.startTimeAdministrator ?? '',
    'End Time (Administrator)': job.endTimeAdministrator ?? '',
    'Travelling Charges (Administrator)': job.travellingChargesAdministrator ?? '',
    'Travelling Km': job.travellingKm ?? '',
    'Travelling Km Rate': job.travellingKmRate ?? '',
    'Reconciliation Status': job.reconciliationStatus ?? '',
  };
}

/** §2.4 — Transcript audit snapshot. */
export function getTranscriptAuditFieldMap(transcript) {
  if (!transcript) return {};
  const owners = Array.isArray(transcript.transcriptOwnerLabels)
    ? transcript.transcriptOwnerLabels.filter(Boolean).join(', ')
    : '';
  return {
    'Job Number': transcript.jobNumber ?? '',
    Type: transcript.type ?? '',
    Status: transcript.status ?? '',
    'Job Status': transcript.jobStatus ?? '',
    Customer: transcript.customerName ?? '',
    Project: transcript.projectNumber || transcript.projectId || '',
    Date: transcript.date ?? '',
    Time: transcript.time ?? '',
    Stenotypist: transcript.stenotypistName || transcript.stenotypistAlias || '',
    Expedite: transcript.expedite ?? '',
    'Receipt Number (Stenotypist)': transcript.receiptNumberStenotypist ?? '',
    'Start Time (Stenotypist)': transcript.startTimeStenotypist ?? '',
    'End Time (Stenotypist)': transcript.endTimeStenotypist ?? '',
    'Transcript Owners': owners,
    'Page Count': transcript.pageCount ?? '',
    'ETE Minutes': transcript.eteMinutes ?? '',
    Editor: transcript.editorName ?? '',
    'Editor Remarks': transcript.editorRemarks ?? '',
    Reviewer: transcript.reviewerName ?? '',
    'Reviewer Remarks': transcript.reviewerRemarks ?? '',
    Publisher: transcript.publisherName ?? '',
    'Publisher Remarks': transcript.publisherRemarks ?? '',
    'Edit Duration (minutes)': transcript.editDurationMinutes ?? '',
    'Review Start Time': transcript.reviewStartTime ?? '',
    'Review End Time': transcript.reviewEndTime ?? '',
    'Bypass Approval': transcript.bypassApproval ?? false,
    'Special Notes': transcript.specialNotes ?? '',
    'Service Level Agreement': transcript.serviceLevelAgreement ?? '',
    'Deadline (minutes)': transcript.deadlineMinutes ?? '',
    'Job End Time': transcript.jobEndTime ?? '',
  };
}

/** §2.5 — Travelling Charge audit snapshot. */
export function getTravellingChargeAuditFieldMap(charge) {
  if (!charge) return {};
  return {
    Customer: charge.customerName || charge.customerAlias || charge.customerId || '',
    District: charge.districtName || charge.districtAlias || charge.districtId || '',
    Amount: charge.amount ?? '',
    'Valid From': charge.validityFrom ?? '',
  };
}

/** §2.5 — Proforma audit snapshot. */
export function getProformaAuditFieldMap(proforma) {
  if (!proforma) return {};
  const billingPeriod =
    proforma.billingYear && proforma.billingMonth
      ? `${proforma.billingYear}-${String(proforma.billingMonth).padStart(2, '0')}`
      : '';
  return {
    'Proforma Number': proforma.proformaNumber ?? '',
    Customer: proforma.customerLabel || proforma.customerName || proforma.customerAlias || '',
    'Customer Reference': proforma.customerReference ?? '',
    'Proforma Date': proforma.proformaDate ?? '',
    'Billing Period': billingPeriod,
    'Document Type': proforma.documentType ?? '',
    Status: proforma.status ?? '',
    'Job Count': proforma.jobCount ?? (Array.isArray(proforma.jobIds) ? proforma.jobIds.length : ''),
    'Total Amount': proforma.totalAmount ?? '',
    'Priority ERP Document Number': proforma.priorityErpDocumentNumber ?? '',
    'Priority ERP Posted At': proforma.priorityErpPostedAt ?? '',
    'Void Reason': proforma.voidReason ?? '',
    'Replaces Proforma': proforma.replacesProformaId ?? '',
    'Replaced By Proforma': proforma.replacedByProformaId ?? '',
  };
}

/** §2.5 — Stenotypist Bonus configuration audit snapshot. */
export function getStenotypistBonusAuditFieldMap(configuration) {
  if (!configuration) return {};
  return {
    Stenotypist:
      configuration.stenotypistFullName ||
      configuration.stenotypistUsername ||
      configuration.stenotypistUserId ||
      '',
    'Base Hours': configuration.baseHours ?? '',
    'Bonus Per Extra Hour': configuration.bonusPerExtraHour ?? '',
    'Valid From': configuration.validFrom ?? '',
  };
}

/** §2.5 — Stenotypist Penalty configuration audit snapshot. */
export function getStenotypistPenaltyAuditFieldMap(configuration) {
  if (!configuration) return {};
  return {
    'Grace Period (hours)': configuration.gracePeriodHours ?? '',
    'Base Penalty': configuration.basePenalty ?? '',
    'Extra Penalty Per Hour': configuration.extraPenaltyPerHour ?? '',
    'Valid From': configuration.validFrom ?? '',
  };
}

/** §2.5 — Travel Expense configuration audit snapshot. */
export function getTravelExpenseAuditFieldMap(configuration) {
  if (!configuration) return {};
  return {
    Stenotypist:
      configuration.stenotypistFullName ||
      configuration.stenotypistUsername ||
      configuration.stenotypistUserId ||
      '',
    District:
      configuration.districtName || configuration.districtAlias || configuration.districtId || '',
    Amount: configuration.amount ?? '',
    'Valid From': configuration.validFrom ?? '',
  };
}

/** §2.5 — Job Travel Expense audit snapshot. */
export function getJobTravelExpenseAuditFieldMap(expense) {
  if (!expense) return {};
  return {
    'Job Number': expense.jobNumber ?? '',
    'Job Date': expense.jobDate ?? '',
    Stenotypist:
      expense.stenotypistFullName || expense.stenotypistUsername || expense.stenotypistUserId || '',
    Customer: expense.customerAlias ?? '',
    Project: expense.projectLabel ?? '',
    District:
      expense.projectDistrictName || expense.projectDistrictAlias || expense.projectDistrictId || '',
    Amount: expense.amount ?? '',
    Status: expense.status ?? '',
  };
}


export function formatFileSizeBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function listSubmissionFiles(section) {
  if (!section) return [];
  if (Array.isArray(section)) {
    return section.filter((file) => file && (file.name || file.size));
  }
  if (typeof section === 'object') {
    return Object.values(section).filter((file) => file && typeof file === 'object' && (file.name || file.size));
  }
  return [];
}

function sumFileSizes(files) {
  return files.reduce((total, file) => total + (Number(file.size) || 0), 0);
}

function stableJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

export function getJobSameDayActionsAuditFieldMap(actions) {
  const row = actions ?? {};
  return {
    'Arrest Warrant': row.arrestWarrant ?? false,
    'Arrest Warrant Details': row.arrestWarrantDetails ?? '',
    'Witness Summons': row.witnessSummons ?? false,
    'Witness Summons Details': row.witnessSummonsDetails ?? '',
    'Defendant Terms': row.defendantTerms ?? false,
    'Defendant Terms Details': row.defendantTermsDetails ?? '',
    'Welfare Report': row.welfareReport ?? false,
    'Welfare Report Details': row.welfareReportDetails ?? '',
    'Other Details': row.otherDetails ?? '',
  };
}

/**
 * §2.3 — Record Job submission mutations:
 * Raw Files Uploaded, Attachments Uploaded, Other Files Uploaded, Same Day Actions Updated.
 */
export function recordJobSubmissionChangeEntries({
  actor,
  job,
  beforeSubmission = null,
  afterSubmission = null,
} = {}) {
  if (!afterSubmission) return 0;
  const entityNumber = job?.jobNumber || job?.id || afterSubmission.jobId || '';
  let count = 0;

  const beforeRaw = beforeSubmission?.rawFiles ?? null;
  const afterRaw = afterSubmission.rawFiles ?? null;
  if (stableJson(beforeRaw) !== stableJson(afterRaw)) {
    const files = listSubmissionFiles(afterRaw);
    if (files.length > 0) {
      recordAuditEntry({
        actor,
        module: 'scheduling',
        entityName: 'job',
        entityNumber,
        entryType: 'raw_files_uploaded',
        entryDetails: buildFileTransferEntryDetails({
          fileSize: formatFileSizeBytes(sumFileSizes(files)),
          duration: '',
        }),
      });
      count += 1;
    }
  }

  const beforeAttachments = beforeSubmission?.attachmentFiles ?? null;
  const afterAttachments = afterSubmission.attachmentFiles ?? null;
  if (stableJson(beforeAttachments) !== stableJson(afterAttachments)) {
    const files = listSubmissionFiles(afterAttachments);
    if (files.length > 0) {
      recordAuditEntry({
        actor,
        module: 'scheduling',
        entityName: 'job',
        entityNumber,
        entryType: 'attachments_uploaded',
        entryDetails: buildFileTransferEntryDetails({
          fileSize: formatFileSizeBytes(sumFileSizes(files)),
          duration: '',
        }),
      });
      count += 1;
    }
  }

  const beforeOther = beforeSubmission?.otherFiles ?? [];
  const afterOther = afterSubmission.otherFiles ?? [];
  if (stableJson(beforeOther) !== stableJson(afterOther)) {
    const files = listSubmissionFiles(afterOther);
    if (files.length > 0) {
      recordAuditEntry({
        actor,
        module: 'scheduling',
        entityName: 'job',
        entityNumber,
        entryType: 'other_files_uploaded',
        entryDetails: buildFileTransferEntryDetails({
          fileSize: formatFileSizeBytes(sumFileSizes(files)),
          duration: '',
        }),
      });
      count += 1;
    }
  }

  const beforeActions = beforeSubmission?.sameDayActions ?? null;
  const afterActions = afterSubmission.sameDayActions ?? null;
  if (stableJson(beforeActions) !== stableJson(afterActions)) {
    const fieldChanges = buildUpdatedDetailsFromMaps(
      getJobSameDayActionsAuditFieldMap(beforeActions),
      getJobSameDayActionsAuditFieldMap(afterActions),
    );
    if ((fieldChanges.fields ?? []).length > 0) {
      recordAuditEntry({
        actor,
        module: 'scheduling',
        entityName: 'job',
        entityNumber,
        entryType: 'same_day_actions_updated',
        entryDetails: fieldChanges,
      });
      count += 1;
    }
  }

  return count;
}

function serializeEntryDetails(entryType, entryDetails) {
  if (entryType === 'deleted' || entryType === 'session_closed') {
    return '';
  }
  if (typeof entryDetails === 'string') {
    return entryDetails.trim();
  }
  if (entryDetails === null || entryDetails === undefined) {
    return '';
  }
  try {
    return JSON.stringify(entryDetails);
  } catch {
    return String(entryDetails);
  }
}

/**
 * §1.2 — Record a significant activity entry.
 * Does not record audit-trail reads, and callers must omit secrets from entryDetails.
 */
export function createAuditEntry({
  actor = null,
  userId = '',
  module = '',
  entityName = '',
  entityNumber = '',
  entryType = '',
  entryDetails = '',
} = {}) {
  const resolvedUserId = userId || actor?.id || '';
  const user = resolvedUserId ? findUserById(resolvedUserId) : null;
  const data = readAuditTrailFile();
  const entry = {
    id: generateAuditEntryId(),
    timestamp: new Date().toISOString(),
    userId: resolvedUserId,
    userFullName: user?.fullName ?? actor?.fullName ?? '',
    userUsername: user?.username ?? actor?.username ?? '',
    module: typeof module === 'string' ? module.trim() : '',
    entityName: typeof entityName === 'string' ? entityName.trim() : '',
    entityNumber: typeof entityNumber === 'string' ? entityNumber.trim() : String(entityNumber ?? ''),
    entryType: typeof entryType === 'string' ? entryType.trim() : '',
    entryDetails: serializeEntryDetails(
      typeof entryType === 'string' ? entryType.trim() : '',
      entryDetails,
    ),
  };
  data.entries = [entry, ...(data.entries ?? [])];
  writeAuditTrailFile(data);
  return toPublicAuditEntry(entry);
}

/** Safe wrapper — never throws into calling request handlers. */
export function recordAuditEntry(options = {}) {
  try {
    return createAuditEntry(options);
  } catch (error) {
    console.error('Failed to record audit trail entry:', error);
    return null;
  }
}

export function listAuditTrailRecords(actor, options = {}) {
  const denied = assertAuditTrailAccess(actor);
  if (denied) return denied;

  const dateFrom = normalizeIsoDate(options.dateFrom);
  const dateTo = normalizeIsoDate(options.dateTo);
  const userId = typeof options.userId === 'string' ? options.userId.trim() : '';
  const module = typeof options.module === 'string' ? options.module.trim() : '';
  const entityName = typeof options.entityName === 'string' ? options.entityName.trim() : '';
  const entityNumber =
    typeof options.entityNumber === 'string' ? options.entityNumber.trim().toLowerCase() : '';
  const entryType = typeof options.entryType === 'string' ? options.entryType.trim() : '';

  const rows = (readAuditTrailFile().entries ?? [])
    .map(toPublicAuditEntry)
    .filter((entry) => {
      const entryDate = (entry.timestamp ?? '').slice(0, 10);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (userId && entry.userId !== userId) return false;
      if (module && entry.module !== module) return false;
      if (entityName && entry.entityName !== entityName) return false;
      if (entityNumber && !(entry.entityNumber ?? '').toLowerCase().includes(entityNumber)) {
        return false;
      }
      if (entryType && entry.entryType !== entryType) return false;
      return true;
    })
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));

  return { entries: rows };
}

export function findAuditTrailRecordById(actor, entryId) {
  const denied = assertAuditTrailAccess(actor);
  if (denied) return denied;

  const entry = (readAuditTrailFile().entries ?? []).find((row) => row.id === entryId);
  if (!entry) {
    return { errors: ['auditTrailEntryNotFound'] };
  }
  return { entry: toPublicAuditEntry(entry) };
}

export function listAuditTrailFilterOptions(actor) {
  const denied = assertAuditTrailAccess(actor);
  if (denied) return denied;

  return {
    users: listUsers()
      .map((user) => ({
        id: user.id,
        fullName: user.fullName ?? '',
        username: user.username ?? '',
      }))
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }),
      ),
    modules: [...AUDIT_MODULES],
    entityNames: [...AUDIT_ENTITY_NAMES],
    entryTypes: [...AUDIT_ENTRY_TYPES],
  };
}
