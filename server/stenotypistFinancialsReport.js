import { findUserById, listUsers } from './db.js';
import { buildJobTravelExpenseRows } from './jobTravelExpenses.js';
import { hasPermission } from './permissions.js';
import { normalizeRoles } from './roles.js';
import { buildMonthlyBonusRows } from './stenotypistBonuses.js';
import { buildPenaltyRows } from './stenotypistPenalties.js';

function normalizeIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function assertFinancialsReportAccess(actor) {
  if (!hasPermission(actor, 'financials.stenotypist_financials_report')) {
    return { errors: ['forbidden'] };
  }
  return null;
}

/** §7.2 — Stenotypists may only view their own financials report rows. */
export function isStenotypistFinancialsReportSelfServiceOnly(actor) {
  const roles = normalizeRoles(actor);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

function resolveStenotypistFilter(actor, requestedStenotypistUserId) {
  if (isStenotypistFinancialsReportSelfServiceOnly(actor)) {
    return actor.id;
  }
  return typeof requestedStenotypistUserId === 'string' ? requestedStenotypistUserId.trim() : '';
}

function ensureRow(map, stenotypistUserId, fullName, username, jobDate) {
  const existing = map.get(stenotypistUserId);
  if (existing) {
    if (jobDate && (!existing.earliestJobDate || jobDate < existing.earliestJobDate)) {
      existing.earliestJobDate = jobDate;
    }
    if (fullName && !existing.stenotypistFullName) {
      existing.stenotypistFullName = fullName;
    }
    if (username && !existing.stenotypistUsername) {
      existing.stenotypistUsername = username;
    }
    return existing;
  }

  const user = findUserById(stenotypistUserId);
  const row = {
    stenotypistUserId,
    stenotypistFullName: fullName || user?.fullName || '',
    stenotypistUsername: username || user?.username || '',
    bonus: 0,
    penalty: 0,
    travelExpenses: 0,
    total: 0,
    earliestJobDate: jobDate || '',
  };
  map.set(stenotypistUserId, row);
  return row;
}

/** §7.1 — Aggregate bonuses, penalties, and approved travel expenses per stenotypist. */
export function buildStenotypistFinancialsReportRows({
  actor = null,
  stenotypistUserId = '',
  dateFrom = '',
  dateTo = '',
} = {}) {
  const rangeFrom = dateFrom || '0000-01-01';
  const rangeTo = dateTo || '9999-12-31';
  const byStenotypist = new Map();

  for (const bonusRow of buildMonthlyBonusRows({
    actor,
    stenotypistUserId,
    dateFrom: rangeFrom,
    dateTo: rangeTo,
  })) {
    const row = ensureRow(
      byStenotypist,
      bonusRow.stenotypistUserId,
      bonusRow.stenotypistFullName,
      bonusRow.stenotypistUsername,
      `${bonusRow.year}-${String(bonusRow.month).padStart(2, '0')}-01`,
    );
    row.bonus = roundMoney(row.bonus + (bonusRow.bonus ?? 0));
  }

  for (const penaltyRow of buildPenaltyRows({
    actor,
    stenotypistUserId,
    dateFrom: rangeFrom,
    dateTo: rangeTo,
  })) {
    const row = ensureRow(
      byStenotypist,
      penaltyRow.stenotypistUserId,
      penaltyRow.stenotypistFullName,
      penaltyRow.stenotypistUsername,
      penaltyRow.jobDate,
    );
    row.penalty = roundMoney(row.penalty + (penaltyRow.totalPenalty ?? 0));
  }

  for (const travelRow of buildJobTravelExpenseRows({
    actor,
    stenotypistUserId,
    dateFrom: rangeFrom,
    dateTo: rangeTo,
    status: 'approved',
  })) {
    const row = ensureRow(
      byStenotypist,
      travelRow.stenotypistUserId,
      travelRow.stenotypistFullName,
      travelRow.stenotypistUsername,
      travelRow.jobDate,
    );
    row.travelExpenses = roundMoney(row.travelExpenses + (travelRow.amount ?? 0));
  }

  return [...byStenotypist.values()]
    .map((row) => ({
      id: row.stenotypistUserId,
      stenotypistUserId: row.stenotypistUserId,
      stenotypistFullName: row.stenotypistFullName,
      stenotypistUsername: row.stenotypistUsername,
      bonus: row.bonus,
      penalty: row.penalty,
      travelExpenses: row.travelExpenses,
      total: roundMoney(row.bonus + row.penalty + row.travelExpenses),
      earliestJobDate: row.earliestJobDate,
    }))
    .sort((a, b) => {
      if (a.earliestJobDate !== b.earliestJobDate) {
        return (a.earliestJobDate || '').localeCompare(b.earliestJobDate || '');
      }
      return a.stenotypistFullName.localeCompare(b.stenotypistFullName, undefined, {
        sensitivity: 'base',
      });
    });
}

/** §7.1 — List stenotypist financials report rows with filters. */
export function listStenotypistFinancialsReportRecords(actor, options = {}) {
  const denied = assertFinancialsReportAccess(actor);
  if (denied) return denied;

  const stenotypistUserId = resolveStenotypistFilter(actor, options.stenotypistUserId);
  const dateFrom = normalizeIsoDate(options.dateFrom);
  const dateTo = normalizeIsoDate(options.dateTo);
  const rows = buildStenotypistFinancialsReportRows({
    actor,
    stenotypistUserId,
    dateFrom,
    dateTo,
  });

  const totals = rows.reduce(
    (acc, row) => ({
      bonus: roundMoney(acc.bonus + row.bonus),
      penalty: roundMoney(acc.penalty + row.penalty),
      travelExpenses: roundMoney(acc.travelExpenses + row.travelExpenses),
      total: roundMoney(acc.total + row.total),
    }),
    { bonus: 0, penalty: 0, travelExpenses: 0, total: 0 },
  );

  return { rows, totals };
}

export function listStenotypistFinancialsReportCandidates(actor) {
  const denied = assertFinancialsReportAccess(actor);
  if (denied) return denied;

  if (isStenotypistFinancialsReportSelfServiceOnly(actor)) {
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
