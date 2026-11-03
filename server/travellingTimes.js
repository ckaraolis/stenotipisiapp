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
import { findDistrictById } from './districts.js';



const TRAVELLING_TIMES_PATH = path.join(DB_DIR, 'travellingTimes.json');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readTravellingTimesFile() {
  ensureCollectionFile('travellingTimes', { trips: [] });
  return readCollection('travellingTimes', { trips: [] });
}

function writeTravellingTimesFile(data) {
  writeCollection('travellingTimes', data);
}

function generateTravellingTimeId() {
  return `tt-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeValidityFrom(value) {
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

export function normalizeTravellingTimeMinutes(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
    return null;
  }

  return number;
}

function normalizeDistrictId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEnabledDistrict(districtId) {
  const district = findDistrictById(districtId);
  return Boolean(district && district.enabled !== false);
}

function migrateTravellingTimeRecord(trip) {
  const now = new Date().toISOString();
  return {
    id: trip.id ?? generateTravellingTimeId(),
    district1Id: normalizeDistrictId(trip.district1Id),
    district2Id: normalizeDistrictId(trip.district2Id),
    travellingTime: normalizeTravellingTimeMinutes(trip.travellingTime) ?? 0,
    validityFrom: normalizeValidityFrom(trip.validityFrom),
    createdAt: trip.createdAt ?? now,
    updatedAt: trip.updatedAt ?? now,
  };
}

export function migrateTravellingTimes() {
  const data = readTravellingTimesFile();
  let changed = false;
  data.trips = (data.trips ?? []).map((trip) => {
    const migrated = migrateTravellingTimeRecord(trip);
    if (JSON.stringify(migrated) !== JSON.stringify(trip)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeTravellingTimesFile(data);
  }
  return data;
}

export function ensureTravellingTimesDatabase() {
  ensureCollectionFile('travellingTimes', { trips: [] });
}

function toPublicDistrict(districtId) {
  const district = findDistrictById(districtId);
  return {
    id: district?.id ?? districtId,
    name: district?.name ?? '',
    alias: district?.alias ?? '',
  };
}

function toPublicTravellingTime(trip) {
  const district1 = toPublicDistrict(trip.district1Id);
  const district2 = toPublicDistrict(trip.district2Id);
  return {
    id: trip.id,
    district1Id: trip.district1Id,
    district1Name: district1.name,
    district1Alias: district1.alias,
    district2Id: trip.district2Id,
    district2Name: district2.name,
    district2Alias: district2.alias,
    travellingTime: trip.travellingTime,
    validityFrom: trip.validityFrom,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

export function listTravellingTimeRecords() {
  const data = readTravellingTimesFile();
  return (data.trips ?? [])
    .map(toPublicTravellingTime)
    .sort(
      (a, b) =>
        b.validityFrom.localeCompare(a.validityFrom) ||
        a.district1Name.localeCompare(b.district1Name, undefined, { sensitivity: 'base' }) ||
        a.district2Name.localeCompare(b.district2Name, undefined, { sensitivity: 'base' }),
    );
}

export function findTravellingTimeById(tripId) {
  if (!tripId) return null;
  const data = readTravellingTimesFile();
  return data.trips.find((row) => row.id === tripId) ?? null;
}

export function findTravellingTimeRecordById(tripId) {
  const trip = findTravellingTimeById(tripId);
  if (!trip) return null;
  return toPublicTravellingTime(trip);
}

function validateTravellingTimeInput(input, { existingId = null } = {}) {
  const errors = [];
  const district1Id = normalizeDistrictId(input.district1Id);
  const district2Id = normalizeDistrictId(input.district2Id);
  const travellingTime = normalizeTravellingTimeMinutes(input.travellingTime);
  const validityFrom = normalizeValidityFrom(input.validityFrom);

  if (!district1Id) {
    errors.push('travellingTimeDistrict1Required');
  } else if (!isEnabledDistrict(district1Id)) {
    errors.push('travellingTimeDistrict1Invalid');
  }

  if (!district2Id) {
    errors.push('travellingTimeDistrict2Required');
  } else if (!isEnabledDistrict(district2Id)) {
    errors.push('travellingTimeDistrict2Invalid');
  }

  if (district1Id && district2Id && district1Id === district2Id) {
    errors.push('travellingTimeDistrictsMustDiffer');
  }

  if (travellingTime === null) {
    errors.push('travellingTimeMinutesRequired');
  }

  if (!validityFrom) {
    errors.push('travellingTimeValidityFromRequired');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const data = readTravellingTimesFile();
  const duplicate = (data.trips ?? []).find(
    (row) =>
      row.id !== existingId &&
      row.district1Id === district1Id &&
      row.district2Id === district2Id &&
      row.validityFrom === validityFrom,
  );
  if (duplicate) {
    errors.push('travellingTimeDuplicate');
    return { errors };
  }

  return {
    value: {
      district1Id,
      district2Id,
      travellingTime,
      validityFrom,
    },
  };
}

export function createTravellingTime(input) {
  const validation = validateTravellingTimeInput(input);
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const data = readTravellingTimesFile();
  const now = new Date().toISOString();
  const trip = {
    id: generateTravellingTimeId(),
    district1Id: validation.value.district1Id,
    district2Id: validation.value.district2Id,
    travellingTime: validation.value.travellingTime,
    validityFrom: validation.value.validityFrom,
    createdAt: now,
    updatedAt: now,
  };

  data.trips.push(trip);
  writeTravellingTimesFile(data);
  return { trip: toPublicTravellingTime(trip) };
}

export function updateTravellingTime(tripId, input) {
  const data = readTravellingTimesFile();
  const index = (data.trips ?? []).findIndex((row) => row.id === tripId);
  if (index === -1) {
    return { errors: ['travellingTimeNotFound'] };
  }

  const validation = validateTravellingTimeInput(input, { existingId: tripId });
  if (validation.errors) {
    return { errors: validation.errors };
  }

  const updated = {
    ...data.trips[index],
    district1Id: validation.value.district1Id,
    district2Id: validation.value.district2Id,
    travellingTime: validation.value.travellingTime,
    validityFrom: validation.value.validityFrom,
    updatedAt: new Date().toISOString(),
  };

  data.trips[index] = updated;
  writeTravellingTimesFile(data);
  return { trip: toPublicTravellingTime(updated) };
}

export function deleteTravellingTime(tripId) {
  const data = readTravellingTimesFile();
  const index = (data.trips ?? []).findIndex((row) => row.id === tripId);
  if (index === -1) {
    return { errors: ['travellingTimeNotFound'] };
  }

  const [removed] = data.trips.splice(index, 1);
  writeTravellingTimesFile(data);
  return { trip: toPublicTravellingTime(removed) };
}
