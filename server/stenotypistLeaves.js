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
import { findUserById, listUsers } from './db.js';
import { queueNotification } from './notifications.js';
import { normalizeRoles } from './roles.js';

const LEAVES_PATH = path.join(DB_DIR, 'stenotypistLeaves.json');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** §2.1 — Hardcoded leave reasons. */
export const STENOTYPIST_LEAVE_REASONS = [
  'sick_leave',
  'maternity_leave',
  'annual_leave',
  'other',
];

/** §2.1 — Leave statuses. */
export const STENOTYPIST_LEAVE_STATUSES = ['new', 'approved', 'rejected'];

function readLeavesFile() {
  ensureCollectionFile('stenotypistLeaves', { leaves: [] });
  return readCollection('stenotypistLeaves', { leaves: [] });
}

function writeLeavesFile(data) {
  writeCollection('stenotypistLeaves', data);
}

function generateLeaveId() {
  return `sl-${crypto.randomUUID().slice(0, 8)}`;
}

function generateHistoryId() {
  return `slh-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeLeaveDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    return '';
  }

  const date = value.trim();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return '';
  }

  return date;
}

export function normalizeLeaveReason(value) {
  const reason = typeof value === 'string' ? value.trim() : '';
  return STENOTYPIST_LEAVE_REASONS.includes(reason) ? reason : '';
}

export function normalizeLeaveStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  return STENOTYPIST_LEAVE_STATUSES.includes(status) ? status : 'new';
}

export function isStenotypistOnApprovedLeave(stenotypistUserId, dateKey) {
  if (typeof stenotypistUserId !== 'string' || !stenotypistUserId.trim()) return false;
  if (typeof dateKey !== 'string' || !DATE_PATTERN.test(dateKey.trim())) return false;
  const normalizedDate = dateKey.trim();
  const data = readLeavesFile();
  return (data.leaves ?? []).some(
    (leave) =>
      leave.stenotypistUserId === stenotypistUserId.trim() &&
      leave.status === 'approved' &&
      leave.dateFrom <= normalizedDate &&
      leave.dateTo >= normalizedDate,
  );
}

function normalizeHistoryEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: entry?.id ?? generateHistoryId(),
    status: normalizeLeaveStatus(entry?.status),
    changedAt: entry?.changedAt ?? now,
    changedByUserId:
      typeof entry?.changedByUserId === 'string' && entry.changedByUserId.trim()
        ? entry.changedByUserId.trim()
        : null,
    changedByName: typeof entry?.changedByName === 'string' ? entry.changedByName.trim() : '',
    notes: typeof entry?.notes === 'string' ? entry.notes.trim() : '',
  };
}

function userIsStenotypist(userId) {
  const user = findUserById(userId);
  if (!user) return false;
  return normalizeRoles(user).includes('stenotypist');
}

function isManagerOrSuperAdmin(actor) {
  const roles = normalizeRoles(actor);
  return roles.includes('manager') || roles.includes('super_admin');
}

function isStenotypistSelfServiceOnly(actor) {
  const roles = normalizeRoles(actor);
  return roles.includes('stenotypist') && !isManagerOrSuperAdmin(actor);
}

function actorCanAccessLeave(actor, leave) {
  if (!leave) return false;
  if (isManagerOrSuperAdmin(actor)) return true;
  return actor?.id === leave.stenotypistUserId;
}

function migrateLeaveRecord(leave) {
  const now = new Date().toISOString();
  const history = Array.isArray(leave.history)
    ? leave.history.map(normalizeHistoryEntry)
    : [];

  return {
    id: leave.id ?? generateLeaveId(),
    stenotypistUserId:
      typeof leave.stenotypistUserId === 'string' ? leave.stenotypistUserId.trim() : '',
    dateFrom: normalizeLeaveDate(leave.dateFrom),
    dateTo: normalizeLeaveDate(leave.dateTo),
    reason: normalizeLeaveReason(leave.reason),
    status: normalizeLeaveStatus(leave.status),
    createdByUserId:
      typeof leave.createdByUserId === 'string' ? leave.createdByUserId.trim() : '',
    createdByName: typeof leave.createdByName === 'string' ? leave.createdByName.trim() : '',
    history,
    createdAt: leave.createdAt ?? now,
    updatedAt: leave.updatedAt ?? now,
  };
}

export function migrateStenotypistLeaves() {
  const data = readLeavesFile();
  let changed = false;
  data.leaves = (data.leaves ?? []).map((leave) => {
    const migrated = migrateLeaveRecord(leave);
    if (JSON.stringify(migrated) !== JSON.stringify(leave)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeLeavesFile(data);
  }
  return data;
}

export function ensureStenotypistLeavesDatabase() {
  ensureCollectionFile('stenotypistLeaves', { leaves: [] });
}

function toPublicHistoryEntry(entry) {
  return {
    id: entry.id,
    status: entry.status,
    changedAt: entry.changedAt,
    changedByUserId: entry.changedByUserId,
    changedByName: entry.changedByName,
    notes: entry.notes,
  };
}

function toPublicLeave(leave) {
  const stenotypist = findUserById(leave.stenotypistUserId);
  return {
    id: leave.id,
    stenotypistUserId: leave.stenotypistUserId,
    stenotypistName: stenotypist?.fullName ?? '',
    stenotypistUsername: stenotypist?.username ?? '',
    dateFrom: leave.dateFrom,
    dateTo: leave.dateTo,
    reason: leave.reason,
    status: leave.status,
    createdByUserId: leave.createdByUserId ?? '',
    createdByName: leave.createdByName ?? '',
    history: (leave.history ?? []).map(toPublicHistoryEntry),
    createdAt: leave.createdAt,
    updatedAt: leave.updatedAt,
  };
}

export function listStenotypistLeaveRecords(actor = null) {
  const data = readLeavesFile();
  let leaves = data.leaves ?? [];
  if (actor && isStenotypistSelfServiceOnly(actor)) {
    leaves = leaves.filter((leave) => leave.stenotypistUserId === actor.id);
  }
  return leaves
    .map(toPublicLeave)
    .sort(
      (a, b) =>
        b.dateFrom.localeCompare(a.dateFrom) ||
        a.stenotypistName.localeCompare(b.stenotypistName, undefined, { sensitivity: 'base' }),
    );
}

export function findStenotypistLeaveById(leaveId) {
  if (!leaveId) return null;
  const data = readLeavesFile();
  return data.leaves.find((row) => row.id === leaveId) ?? null;
}

export function findStenotypistLeaveRecordById(leaveId, actor = null) {
  const leave = findStenotypistLeaveById(leaveId);
  if (!leave) return null;
  if (actor && !actorCanAccessLeave(actor, leave)) return null;
  return toPublicLeave(leave);
}

export function isValidStenotypistUser(userId) {
  return userIsStenotypist(userId);
}

function appendHistory(history, { status, actor, notes = '' }) {
  return [
    ...history,
    normalizeHistoryEntry({
      status,
      changedByUserId: actor?.id ?? null,
      changedByName: actor?.fullName ?? actor?.username ?? '',
      notes,
    }),
  ];
}

function wasSubmittedByStenotypist(actor, leave) {
  const roles = normalizeRoles(actor);
  return roles.includes('stenotypist') && actor?.id === leave.stenotypistUserId;
}

function listActiveManagers() {
  return listUsers().filter(
    (user) => user.status === 'active' && normalizeRoles(user).includes('manager'),
  );
}

function notifyManagersOfNewLeave(leave, actor) {
  const stenotypist = findUserById(leave.stenotypistUserId);
  const message = `New leave request from ${stenotypist?.fullName ?? 'stenotypist'} (${leave.dateFrom} to ${leave.dateTo}).`;
  for (const manager of listActiveManagers()) {
    queueNotification({
      type: 'stenotypist_leave_submitted',
      message,
      targetUserId: manager.id,
      createdByUserId: actor?.id ?? null,
      actionPath: '/scheduling/stenotypist-leave',
      entityType: 'stenotypist_leave',
      entityId: leave.id,
      emailDetails: [
        { label: 'Stenotypist', value: stenotypist?.fullName || '' },
        { label: 'Date From', value: leave.dateFrom },
        { label: 'Date To', value: leave.dateTo },
        { label: 'Reason', value: leave.reason },
      ],
    });
  }
}

function notifyStenotypistOfStatusChange(leave, actor, status) {
  const label = status === 'approved' ? 'approved' : 'rejected';
  const message = `Your leave request (${leave.dateFrom} to ${leave.dateTo}) has been ${label}.`;
  queueNotification({
    type: `stenotypist_leave_${status}`,
    message,
    targetUserId: leave.stenotypistUserId,
    createdByUserId: actor?.id ?? null,
    actionPath: '/scheduling/stenotypist-leave',
    entityType: 'stenotypist_leave',
    entityId: leave.id,
    emailDetails: [
      { label: 'Date From', value: leave.dateFrom },
      { label: 'Date To', value: leave.dateTo },
      { label: 'Decision', value: label },
    ],
  });
}

function validateStenotypistLeaveInput(input, { existingId = null } = {}) {
  const errors = [];
  const stenotypistUserId =
    typeof input.stenotypistUserId === 'string' ? input.stenotypistUserId.trim() : '';
  const dateFrom = normalizeLeaveDate(input.dateFrom);
  const dateTo = normalizeLeaveDate(input.dateTo);
  const reason = normalizeLeaveReason(input.reason);

  if (!stenotypistUserId) {
    errors.push('stenotypistRequired');
  } else if (!userIsStenotypist(stenotypistUserId)) {
    errors.push('stenotypistInvalid');
  }

  if (!dateFrom) errors.push('stenotypistLeaveDateFromRequired');
  if (!dateTo) errors.push('stenotypistLeaveDateToRequired');
  if (dateFrom && dateTo && dateFrom > dateTo) errors.push('stenotypistLeaveDateRangeInvalid');
  if (!reason) errors.push('stenotypistLeaveReasonRequired');

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      stenotypistUserId,
      dateFrom,
      dateTo,
      reason,
      status: normalizeLeaveStatus(input.status),
    },
  };
}

export function listStenotypistCandidates(actor) {
  const candidates = listUsers()
    .filter(
      (user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'),
    )
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

  const roles = normalizeRoles(actor);
  if (roles.includes('manager') || roles.includes('super_admin')) {
    return candidates;
  }
  if (roles.includes('stenotypist')) {
    return candidates.filter((user) => user.id === actor.id);
  }
  return candidates;
}

export function createStenotypistLeave(input, actor) {
  const validation = validateStenotypistLeaveInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  if (
    isStenotypistSelfServiceOnly(actor) &&
    validation.value.stenotypistUserId !== actor.id
  ) {
    return { errors: ['stenotypistLeaveForbidden'] };
  }

  const data = readLeavesFile();
  const now = new Date().toISOString();
  const status = isStenotypistSelfServiceOnly(actor)
    ? 'new'
    : validation.value.status || 'new';
  const leave = {
    id: generateLeaveId(),
    stenotypistUserId: validation.value.stenotypistUserId,
    dateFrom: validation.value.dateFrom,
    dateTo: validation.value.dateTo,
    reason: validation.value.reason,
    status,
    createdByUserId: actor?.id ?? '',
    createdByName: actor?.fullName ?? actor?.username ?? '',
    history: appendHistory([], { status, actor }),
    createdAt: now,
    updatedAt: now,
  };

  data.leaves.push(leave);
  writeLeavesFile(data);

  const publicLeave = toPublicLeave(leave);
  if (wasSubmittedByStenotypist(actor, leave)) {
    notifyManagersOfNewLeave(publicLeave, actor);
  }

  return { leave: publicLeave };
}

export function updateStenotypistLeave(leaveId, input, actor) {
  const data = readLeavesFile();
  const index = (data.leaves ?? []).findIndex((row) => row.id === leaveId);
  if (index === -1) {
    return { errors: ['stenotypistLeaveNotFound'] };
  }

  const validation = validateStenotypistLeaveInput(input, { existingId: leaveId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const existing = data.leaves[index];
  if (!actorCanAccessLeave(actor, existing)) {
    return { errors: ['stenotypistLeaveForbidden'] };
  }

  if (isStenotypistSelfServiceOnly(actor)) {
    if (existing.status !== 'new') {
      return { errors: ['stenotypistLeaveEditNotAllowed'] };
    }
    if (validation.value.stenotypistUserId !== actor.id) {
      return { errors: ['stenotypistLeaveForbidden'] };
    }
  }

  const previousStatus = existing.status;
  const nextStatus = isStenotypistSelfServiceOnly(actor)
    ? existing.status
    : validation.value.status || existing.status;
  let history = Array.isArray(existing.history) ? [...existing.history] : [];

  if (previousStatus !== nextStatus) {
    history = appendHistory(history, { status: nextStatus, actor });
  }

  const updated = {
    ...existing,
    stenotypistUserId: validation.value.stenotypistUserId,
    dateFrom: validation.value.dateFrom,
    dateTo: validation.value.dateTo,
    reason: validation.value.reason,
    status: nextStatus,
    history,
    updatedAt: new Date().toISOString(),
  };

  data.leaves[index] = updated;
  writeLeavesFile(data);

  const publicLeave = toPublicLeave(updated);
  if (
    previousStatus !== nextStatus &&
    (nextStatus === 'approved' || nextStatus === 'rejected')
  ) {
    notifyStenotypistOfStatusChange(publicLeave, actor, nextStatus);
  }

  return { leave: publicLeave };
}

export function deleteStenotypistLeave(leaveId, actor) {
  const data = readLeavesFile();
  const index = (data.leaves ?? []).findIndex((row) => row.id === leaveId);
  if (index === -1) {
    return { errors: ['stenotypistLeaveNotFound'] };
  }

  const leave = data.leaves[index];
  if (!actorCanAccessLeave(actor, leave)) {
    return { errors: ['stenotypistLeaveForbidden'] };
  }
  if (isStenotypistSelfServiceOnly(actor) && leave.status !== 'new') {
    return { errors: ['stenotypistLeaveDeleteNotAllowed'] };
  }

  const [removed] = data.leaves.splice(index, 1);
  writeLeavesFile(data);
  return { leave: toPublicLeave(removed) };
}

export function updateStenotypistLeaveStatus(leaveId, status, actor) {
  if (!isManagerOrSuperAdmin(actor)) {
    return { errors: ['stenotypistLeaveForbidden'] };
  }

  const leave = findStenotypistLeaveById(leaveId);
  if (!leave) {
    return { errors: ['stenotypistLeaveNotFound'] };
  }

  const normalized = normalizeLeaveStatus(status);
  if (normalized !== 'approved' && normalized !== 'rejected') {
    return { errors: ['stenotypistLeaveStatusInvalid'] };
  }

  return updateStenotypistLeave(
    leaveId,
    {
      stenotypistUserId: leave.stenotypistUserId,
      dateFrom: leave.dateFrom,
      dateTo: leave.dateTo,
      reason: leave.reason,
      status: normalized,
    },
    actor,
  );
}
