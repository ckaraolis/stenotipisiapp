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

const PUBLIC_HOLIDAYS_PATH = path.join(DB_DIR, 'publicHolidays.json');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readPublicHolidaysFile() {
  ensureCollectionFile('publicHolidays', { holidays: [] });
  return readCollection('publicHolidays', { holidays: [] });
}

function writePublicHolidaysFile(data) {
  writeCollection('publicHolidays', data);
}

function generatePublicHolidayId() {
  return `ph-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeHolidayName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeHolidayDate(value) {
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

function migratePublicHolidayRecord(holiday) {
  const now = new Date().toISOString();
  return {
    id: holiday.id ?? generatePublicHolidayId(),
    name: normalizeHolidayName(holiday.name),
    date: normalizeHolidayDate(holiday.date),
    createdAt: holiday.createdAt ?? now,
    updatedAt: holiday.updatedAt ?? now,
  };
}

export function migratePublicHolidays() {
  const data = readPublicHolidaysFile();
  let changed = false;
  data.holidays = (data.holidays ?? []).map((holiday) => {
    const migrated = migratePublicHolidayRecord(holiday);
    if (JSON.stringify(migrated) !== JSON.stringify(holiday)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writePublicHolidaysFile(data);
  }
  return data;
}

export function ensurePublicHolidaysDatabase() {
  ensureCollectionFile('publicHolidays', { holidays: [] });
}

function toPublicHoliday(holiday) {
  return {
    id: holiday.id,
    name: holiday.name,
    date: holiday.date,
    createdAt: holiday.createdAt,
    updatedAt: holiday.updatedAt,
  };
}

export function listPublicHolidayRecords() {
  const data = readPublicHolidaysFile();
  return (data.holidays ?? [])
    .map(toPublicHoliday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function findPublicHolidayById(holidayId) {
  if (!holidayId) return null;
  const data = readPublicHolidaysFile();
  return data.holidays.find((row) => row.id === holidayId) ?? null;
}

export function findPublicHolidayRecordById(holidayId) {
  const holiday = findPublicHolidayById(holidayId);
  if (!holiday) return null;
  return toPublicHoliday(holiday);
}

function validatePublicHolidayInput(input, { existingId = null } = {}) {
  const errors = [];
  const name = normalizeHolidayName(input.name);
  const date = normalizeHolidayDate(input.date);

  if (!name) errors.push('publicHolidayNameRequired');
  if (!date) errors.push('publicHolidayDateRequired');

  const data = readPublicHolidaysFile();
  const dateOwner = (data.holidays ?? []).find(
    (row) => row.date === date && row.id !== existingId,
  );
  if (date && dateOwner) errors.push('publicHolidayDateTaken');

  if (errors.length > 0) {
    return { errors };
  }

  return { value: { name, date } };
}

export function createPublicHoliday(input) {
  const validation = validatePublicHolidayInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readPublicHolidaysFile();
  const now = new Date().toISOString();
  const holiday = {
    id: generatePublicHolidayId(),
    name: validation.value.name,
    date: validation.value.date,
    createdAt: now,
    updatedAt: now,
  };

  data.holidays.push(holiday);
  writePublicHolidaysFile(data);
  return { holiday: toPublicHoliday(holiday) };
}

export function updatePublicHoliday(holidayId, input) {
  const data = readPublicHolidaysFile();
  const index = (data.holidays ?? []).findIndex((row) => row.id === holidayId);
  if (index === -1) {
    return { errors: ['publicHolidayNotFound'] };
  }

  const validation = validatePublicHolidayInput(input, { existingId: holidayId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.holidays[index],
    name: validation.value.name,
    date: validation.value.date,
    updatedAt: new Date().toISOString(),
  };

  data.holidays[index] = updated;
  writePublicHolidaysFile(data);
  return { holiday: toPublicHoliday(updated) };
}

export function deletePublicHoliday(holidayId) {
  const data = readPublicHolidaysFile();
  const index = (data.holidays ?? []).findIndex((row) => row.id === holidayId);
  if (index === -1) {
    return { errors: ['publicHolidayNotFound'] };
  }

  const [removed] = data.holidays.splice(index, 1);
  writePublicHolidaysFile(data);
  return { holiday: toPublicHoliday(removed) };
}
