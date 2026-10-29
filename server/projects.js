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
import { findCustomerById, TRAVELLING_CHARGES_OPTIONS } from './customers.js';
import { findDistrictById } from './districts.js';
import { syncCustomerProjectReferences } from './customerReferences.js';
import { syncFieldValueProjectReferences } from './customerFieldValueReferences.js';
import { projectHasAllocatedJobs } from './projectReferences.js';
import { normalizeRoles } from './roles.js';

const PROJECTS_PATH = path.join(DB_DIR, 'projects.json');
const PROJECT_TRANSCRIPT_OWNERS_PATH = path.join(DB_DIR, 'projectTranscriptOwners.json');
const CUSTOMER_FIELD_VALUES_PATH = path.join(DB_DIR, 'customerFieldValues.json');
const USERS_PATH = path.join(DB_DIR, 'users.json');

export const PROJECT_STATUS_OPTIONS = ['open', 'closed'];

function readProjectsFile() {
  ensureCollectionFile('projects', { projects: [] });
  return readCollection('projects', { projects: [] });
}

function writeProjectsFile(data) {
  writeCollection('projects', data);
}

function readTranscriptOwnersFile() {
  ensureCollectionFile('projectTranscriptOwners', { assignments: [] });
  return readCollection('projectTranscriptOwners', { assignments: [] });
}

function writeTranscriptOwnersFile(data) {
  writeCollection('projectTranscriptOwners', data);
}

function readCustomerFieldValuesFile() {
  ensureCollectionFile('customerFieldValues', { values: [] });
  return readCollection('customerFieldValues', { values: [] });
}

function readUsersFile() {
  ensureCollectionFile('users', { users: [] });
  return readCollection('users', { users: [] });
}

function generateProjectId() {
  return `prj-${crypto.randomUUID().slice(0, 8)}`;
}

function generateTranscriptOwnerAssignmentId() {
  return `pto-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeTravellingCharges(value) {
  if (typeof value !== 'string') return 'non_billable';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  const aliases = {
    billable_by_table: 'billable_by_table',
    billable_by_km: 'billable_by_km',
    non_billable: 'non_billable',
    'non-billable': 'non_billable',
  };
  return aliases[normalized] ?? 'non_billable';
}

function normalizeProjectStatus(value) {
  if (typeof value !== 'string') return 'open';
  const normalized = value.trim().toLowerCase();
  return normalized === 'closed' ? 'closed' : 'open';
}

function nextProjectNumber(projects) {
  let max = 0;
  for (const project of projects) {
    const match = /^PR(\d+)$/i.exec(project.projectNumber ?? '');
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `PR${String(max + 1).padStart(4, '0')}`;
}

function findFieldValueById(fieldValueId) {
  if (!fieldValueId) return null;
  const data = readCustomerFieldValuesFile();
  return (data.values ?? []).find((row) => row.id === fieldValueId) ?? null;
}

function listTranscriptOwnerAssignments(projectId) {
  const data = readTranscriptOwnersFile();
  return (data.assignments ?? []).filter((row) => row.projectId === projectId);
}

/** §4 — Project IDs where the user is assigned as a transcript owner. */
export function getTranscriptOwnerProjectIds(userId) {
  if (!userId) return new Set();
  const data = readTranscriptOwnersFile();
  const ids = new Set();
  for (const row of data.assignments ?? []) {
    if (row.userId === userId && row.projectId) {
      ids.add(row.projectId);
    }
  }
  return ids;
}

export function isProjectTranscriptOwner(userId, projectId) {
  if (!userId || !projectId) return false;
  return getTranscriptOwnerProjectIds(userId).has(projectId);
}

function findUserById(userId) {
  const data = readUsersFile();
  return (data.users ?? []).find((user) => user.id === userId) ?? null;
}

function userIsTranscriptOwnerForCustomer(user, customerId) {
  if (!user || user.status === 'inactive') return false;
  if (user.customerId !== customerId) return false;
  const roles = normalizeRoles(user.roles ?? user.role);
  return roles.includes('transcript_owner');
}

function validateFieldValueReference(customerId, fieldReference, fieldValueId, errors, errorKey) {
  if (!fieldValueId) {
    errors.push(errorKey);
    return null;
  }

  const fieldValue = findFieldValueById(fieldValueId);
  if (
    !fieldValue ||
    fieldValue.customerId !== customerId ||
    fieldValue.fieldReference !== fieldReference
  ) {
    errors.push('projectFieldValueInvalid');
    return null;
  }

  return fieldValueId;
}

function validateTextField(status, value, errors, errorKey) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (status === 'invisible') {
    return '';
  }
  if (status === 'visible_mandatory' && !trimmed) {
    errors.push(errorKey);
    return '';
  }
  return trimmed;
}

function validateTranscriptOwnerIds(customerId, transcriptOwnerIds) {
  const errors = [];
  const ids = Array.isArray(transcriptOwnerIds)
    ? [...new Set(transcriptOwnerIds.filter((id) => typeof id === 'string' && id.trim()))]
    : [];

  if (ids.length === 0) {
    errors.push('projectTranscriptOwnerRequired');
  }

  for (const userId of ids) {
    const user = findUserById(userId);
    if (!userIsTranscriptOwnerForCustomer(user, customerId)) {
      errors.push('projectTranscriptOwnerInvalid');
      break;
    }
  }

  return { errors, transcriptOwnerIds: ids };
}

function validateProjectInput(input, { existingId = null } = {}) {
  const errors = [];
  const customerId =
    typeof input.customerId === 'string' && input.customerId.trim() ? input.customerId.trim() : '';
  const districtId =
    typeof input.districtId === 'string' && input.districtId.trim() ? input.districtId.trim() : '';

  if (!customerId) errors.push('projectCustomerRequired');
  const customer = customerId ? findCustomerById(customerId) : null;
  if (customerId && !customer) errors.push('projectCustomerInvalid');

  if (!districtId) errors.push('projectDistrictRequired');
  if (districtId && !findDistrictById(districtId)) errors.push('projectDistrictInvalid');

  let field1ValueId = null;
  let field2ValueId = null;
  let field3 = '';
  let field4 = '';

  if (customer) {
    if (customer.field1Status === 'invisible') {
      field1ValueId = null;
    } else if (customer.field1Status === 'visible_mandatory') {
      field1ValueId = validateFieldValueReference(
        customerId,
        1,
        input.field1ValueId,
        errors,
        'projectField1Required',
      );
    } else {
      const id =
        typeof input.field1ValueId === 'string' && input.field1ValueId.trim()
          ? input.field1ValueId.trim()
          : null;
      if (id) {
        field1ValueId = validateFieldValueReference(customerId, 1, id, errors, 'projectField1Required');
      }
    }

    if (customer.field2Status === 'invisible') {
      field2ValueId = null;
    } else if (customer.field2Status === 'visible_mandatory') {
      field2ValueId = validateFieldValueReference(
        customerId,
        2,
        input.field2ValueId,
        errors,
        'projectField2Required',
      );
    } else {
      const id =
        typeof input.field2ValueId === 'string' && input.field2ValueId.trim()
          ? input.field2ValueId.trim()
          : null;
      if (id) {
        field2ValueId = validateFieldValueReference(customerId, 2, id, errors, 'projectField2Required');
      }
    }

    field3 = validateTextField(customer.field3Status, input.field3, errors, 'projectField3Required');
    field4 = validateTextField(customer.field4Status, input.field4, errors, 'projectField4Required');
  }

  const travellingCharges = normalizeTravellingCharges(
    input.travellingCharges ?? customer?.travellingCharges ?? 'non_billable',
  );
  const status = normalizeProjectStatus(input.status ?? 'open');

  const ownerValidation = customerId
    ? validateTranscriptOwnerIds(customerId, input.transcriptOwnerIds)
    : { errors: [], transcriptOwnerIds: [] };
  errors.push(...ownerValidation.errors);

  const value = {
    customerId,
    districtId,
    field1ValueId,
    field2ValueId,
    field3,
    field4,
    travellingCharges,
    status,
    transcriptOwnerIds: ownerValidation.transcriptOwnerIds,
  };

  if (existingId) {
    value.id = existingId;
  }

  return { errors, value, customer };
}

function replaceTranscriptOwners(projectId, transcriptOwnerIds) {
  const data = readTranscriptOwnersFile();
  const now = new Date().toISOString();
  data.assignments = (data.assignments ?? []).filter((row) => row.projectId !== projectId);

  for (const userId of transcriptOwnerIds) {
    data.assignments.push({
      id: generateTranscriptOwnerAssignmentId(),
      projectId,
      userId,
      assignedAt: now,
    });
  }

  writeTranscriptOwnersFile(data);
}

function removeTranscriptOwners(projectId) {
  const data = readTranscriptOwnersFile();
  data.assignments = (data.assignments ?? []).filter((row) => row.projectId !== projectId);
  writeTranscriptOwnersFile(data);
}

function getTranscriptOwnerDetails(projectId) {
  const assignments = listTranscriptOwnerAssignments(projectId);
  return assignments
    .map((assignment) => {
      const user = findUserById(assignment.userId);
      if (!user) return null;
      return {
        id: user.id,
        fullName: user.fullName ?? '',
        email: user.email ?? '',
        username: user.username ?? '',
      };
    })
    .filter(Boolean);
}

function migrateProjectRecord(project, index, allProjects) {
  const now = new Date().toISOString();
  let projectNumber = project.projectNumber;
  if (!projectNumber) {
    projectNumber = `PR${String(index + 1).padStart(4, '0')}`;
    const taken = new Set(allProjects.map((row) => row.projectNumber).filter(Boolean));
    while (taken.has(projectNumber)) {
      const num = Number.parseInt(projectNumber.slice(2), 10) + 1;
      projectNumber = `PR${String(num).padStart(4, '0')}`;
    }
  }

  return {
    id: project.id ?? generateProjectId(),
    projectNumber,
    customerId: project.customerId ?? '',
    districtId: project.districtId ?? '',
    field1ValueId: project.field1ValueId ?? null,
    field2ValueId: project.field2ValueId ?? null,
    field3: project.field3 ?? '',
    field4: project.field4 ?? '',
    travellingCharges: normalizeTravellingCharges(project.travellingCharges ?? 'non_billable'),
    status: normalizeProjectStatus(project.status ?? 'open'),
    createdAt: project.createdAt ?? now,
    updatedAt: project.updatedAt ?? now,
  };
}

export function migrateProjects() {
  const data = readProjectsFile();
  let changed = false;
  data.projects = (data.projects ?? []).map((project, index) => {
    const migrated = migrateProjectRecord(project, index, data.projects);
    if (JSON.stringify(migrated) !== JSON.stringify(project)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeProjectsFile(data);
  } else {
    syncCustomerProjectReferences(data.projects ?? []);
    syncFieldValueProjectReferences(data.projects ?? []);
  }
  return data;
}

export function ensureProjectsDatabase() {
  ensureCollectionFile('projects', { projects: [] });
  ensureCollectionFile('projectTranscriptOwners', { assignments: [] });
  migrateProjects();
}

export function toPublicProject(project) {
  const customer = findCustomerById(project.customerId);
  const district = findDistrictById(project.districtId);
  const field1Value = project.field1ValueId ? findFieldValueById(project.field1ValueId) : null;
  const field2Value = project.field2ValueId ? findFieldValueById(project.field2ValueId) : null;
  const transcriptOwners = getTranscriptOwnerDetails(project.id);

  return {
    id: project.id,
    projectNumber: project.projectNumber,
    customerId: project.customerId,
    customerName: customer?.name ?? '',
    customerAlias: customer?.alias ?? '',
    districtId: project.districtId,
    districtName: district?.name ?? '',
    districtAlias: district?.alias ?? '',
    field1ValueId: project.field1ValueId,
    field1Value: field1Value?.value ?? '',
    field1Name: customer?.field1Name ?? '',
    field2ValueId: project.field2ValueId,
    field2Value: field2Value?.value ?? '',
    field2Name: customer?.field2Name ?? '',
    field3: project.field3,
    field3Name: customer?.field3Name ?? '',
    field4: project.field4,
    field4Name: customer?.field4Name ?? '',
    travellingCharges: project.travellingCharges,
    status: project.status,
    transcriptOwnerIds: transcriptOwners.map((owner) => owner.id),
    transcriptOwners,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function listProjectRecords() {
  const data = readProjectsFile();
  return (data.projects ?? [])
    .map((project) => toPublicProject(project))
    .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true }));
}

export function findProjectById(projectId) {
  if (!projectId) return null;
  const data = readProjectsFile();
  return data.projects.find((row) => row.id === projectId) ?? null;
}

export function findProjectRecordById(projectId) {
  const project = findProjectById(projectId);
  if (!project) return null;
  return toPublicProject(project);
}

export function createProject(input) {
  const { errors, value } = validateProjectInput(input);
  if (errors.length > 0) {
    return { errors };
  }

  const data = readProjectsFile();
  const now = new Date().toISOString();
  const { transcriptOwnerIds, ...projectFields } = value;
  const project = {
    id: generateProjectId(),
    projectNumber: nextProjectNumber(data.projects),
    ...projectFields,
    createdAt: now,
    updatedAt: now,
  };

  data.projects.push(project);
  writeProjectsFile(data);
  replaceTranscriptOwners(project.id, transcriptOwnerIds);
  return { project: toPublicProject(project) };
}

export function updateProject(projectId, input) {
  const data = readProjectsFile();
  const index = data.projects.findIndex((row) => row.id === projectId);
  if (index === -1) {
    return { errors: ['projectNotFound'] };
  }

  const { errors, value } = validateProjectInput(input, { existingId: projectId });
  if (errors.length > 0) {
    return { errors };
  }

  const { transcriptOwnerIds, ...projectFields } = value;
  const updated = {
    ...data.projects[index],
    ...projectFields,
    updatedAt: new Date().toISOString(),
  };

  data.projects[index] = updated;
  writeProjectsFile(data);
  replaceTranscriptOwners(projectId, transcriptOwnerIds);
  return { project: toPublicProject(updated) };
}

export function updateProjectStatus(projectId, status) {
  const data = readProjectsFile();
  const index = data.projects.findIndex((row) => row.id === projectId);
  if (index === -1) {
    return { errors: ['projectNotFound'] };
  }

  const updated = {
    ...data.projects[index],
    status: normalizeProjectStatus(status),
    updatedAt: new Date().toISOString(),
  };

  data.projects[index] = updated;
  writeProjectsFile(data);
  return { project: toPublicProject(updated) };
}

export function deleteProject(projectId) {
  const data = readProjectsFile();
  const index = data.projects.findIndex((row) => row.id === projectId);
  if (index === -1) {
    return { errors: ['projectNotFound'] };
  }

  if (projectHasAllocatedJobs(projectId)) {
    return { errors: ['projectHasJobs'] };
  }

  const [removed] = data.projects.splice(index, 1);
  writeProjectsFile(data);
  removeTranscriptOwners(projectId);
  return { project: toPublicProject(removed) };
}

export function listTranscriptOwnerCandidates(customerId, { excludeUserIds = [] } = {}) {
  if (!findCustomerById(customerId)) {
    return { errors: ['projectCustomerInvalid'] };
  }

  const exclude = new Set(
    Array.isArray(excludeUserIds)
      ? excludeUserIds.filter((id) => typeof id === 'string' && id.trim())
      : [],
  );
  const data = readUsersFile();

  const candidates = (data.users ?? [])
    .filter((user) => {
      if (user.customerId !== customerId) return false;
      if (user.status === 'inactive') return false;
      const roles = normalizeRoles(user.roles ?? user.role);
      if (!roles.includes('transcript_owner')) return false;
      return !exclude.has(user.id);
    })
    .map((user) => ({
      id: user.id,
      fullName: user.fullName ?? '',
      username: user.username ?? '',
      email: user.email ?? '',
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

  return { candidates };
}

export { TRAVELLING_CHARGES_OPTIONS, PROJECT_STATUS_OPTIONS as PROJECT_STATUSES };
