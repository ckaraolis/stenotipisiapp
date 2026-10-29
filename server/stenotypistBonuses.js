import { findUserById, listUsers } from './db.js';
import { listJobRecords } from './jobs.js';
import { hasPermission } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { resolveBonusConfigurationForStenotypist } from './stenotypistBonus.js';

function parseTimeToMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof time === 'string' ? time.trim() : '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getBilledHours(job) {
  const start = job.startTimeAdministrator || job.startTimeStenotypist || job.time;
  const end = job.endTimeAdministrator || job.endTimeStenotypist;
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  let adjustedEndMinutes = endMinutes;
  if (adjustedEndMinutes <= startMinutes) adjustedEndMinutes += 24 * 60;
  return (adjustedEndMinutes - startMinutes) / 60;
}

function roundHours(value) {
  return Math.round(value * 1000) / 1000;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function normalizeIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function monthKeyFromDate(date) {
  return date.slice(0, 7);
}

function lastDayOfMonth(year, month) {
  const date = new Date(year, month, 0);
  const day = String(date.getDate()).padStart(2, '0');
  const monthText = String(month).padStart(2, '0');
  return `${year}-${monthText}-${day}`;
}

function toPublicStenotypist(userId) {
  const user = findUserById(userId);
  return {
    id: user?.id ?? userId,
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
  };
}

function assertBonusesListAccess(actor) {
  if (!hasPermission(actor, 'financials.stenotypist_bonuses')) {
    return { errors: ['forbidden'] };
  }
  return null;
}

/** §4.6 — Stenotypists may only view their own bonus rows. */
export function isStenotypistBonusesSelfServiceOnly(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

function resolveStenotypistFilter(actor, requestedStenotypistUserId) {
  if (isStenotypistBonusesSelfServiceOnly(actor)) {
    return actor.id;
  }
  return typeof requestedStenotypistUserId === 'string' ? requestedStenotypistUserId.trim() : '';
}

/** §4.5 — Compute monthly bonus rows from billable job hours. */
export function buildMonthlyBonusRows({ actor = null, stenotypistUserId = '', dateFrom = '', dateTo = '' } = {}) {
  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  const groups = new Map();

  for (const job of listJobRecords(actor)) {
    if (!job.stenotypistUserId?.trim()) continue;
    if (stenotypistUserId && job.stenotypistUserId !== stenotypistUserId) continue;
    if (!job.date || job.date < rangeFrom || job.date > rangeTo) continue;

    const hours = getBilledHours(job);
    if (hours <= 0) continue;

    const key = `${job.stenotypistUserId}::${monthKeyFromDate(job.date)}`;
    const group = groups.get(key) ?? {
      stenotypistUserId: job.stenotypistUserId,
      year: Number(job.date.slice(0, 4)),
      month: Number(job.date.slice(5, 7)),
      totalHours: 0,
    };
    group.totalHours += hours;
    groups.set(key, group);
  }

  const rows = [];
  for (const group of groups.values()) {
    const monthEnd = lastDayOfMonth(group.year, group.month);
    const settings = resolveBonusConfigurationForStenotypist(group.stenotypistUserId, monthEnd);
    const totalHours = roundHours(group.totalHours);
    const baseHours = settings.baseHours;
    const extraHours = roundHours(Math.max(0, totalHours - baseHours));
    const bonusPerExtraHour = settings.bonusPerExtraHour;
    const bonus = roundMoney(extraHours * bonusPerExtraHour);
    const stenotypist = toPublicStenotypist(group.stenotypistUserId);

    rows.push({
      id: `${group.stenotypistUserId}:${group.year}-${String(group.month).padStart(2, '0')}`,
      year: group.year,
      month: group.month,
      stenotypistUserId: group.stenotypistUserId,
      stenotypistFullName: stenotypist.fullName,
      stenotypistUsername: stenotypist.username,
      totalHours,
      baseHours,
      extraHours,
      bonusPerExtraHour,
      bonus,
    });
  }

  return rows.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
      sensitivity: 'base',
    });
  });
}

/** §4.5 — List monthly bonuses with filters. */
export function listMonthlyBonusRecords(actor, options = {}) {
  const denied = assertBonusesListAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = resolveStenotypistFilter(actor, options.stenotypistUserId);
  const dateFrom = normalizeIsoDate(options.dateFrom);
  const dateTo = normalizeIsoDate(options.dateTo);

  return {
    bonuses: buildMonthlyBonusRows({
      actor,
      stenotypistUserId,
      dateFrom,
      dateTo,
    }),
  };
}

export function listBonusesStenotypistCandidates(actor) {
  const denied = assertBonusesListAccess(actor);
  if (denied) return denied;

  if (isStenotypistBonusesSelfServiceOnly(actor)) {
    const user = findUserById(actor.id);
    return {
      candidates: user
        ? [{ id: user.id, fullName: user.fullName, username: user.username }]
        : [],
    };
  }

  return {
    candidates: listUsers()
      .filter((user) => user.status === 'active' && normalizeRoles(user).includes('stenotypist'))
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })),
  };
}
