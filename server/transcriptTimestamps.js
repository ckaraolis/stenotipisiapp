/** §2.5 — Idle gap between timestamps ignored when computing stenotyping hours (seconds). */
export const TRANSCRIPT_STENOTYPING_IDLE_SECONDS = 60;

const TIMESTAMP_PATTERN = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;

function timestampMatchToSeconds(match) {
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/** Extract ordered timestamp values (seconds) from raw transcript-with-timestamps text. */
export function extractTimestampsFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const values = [];
  let match = TIMESTAMP_PATTERN.exec(text);
  while (match) {
    const seconds = timestampMatchToSeconds(match);
    if (seconds !== null) {
      values.push(seconds);
    }
    match = TIMESTAMP_PATTERN.exec(text);
  }

  return values;
}

/**
 * §2.5 — Stenotyping hours from timestamp file: first→last with idle gaps excluded.
 * Returns hours (decimal).
 */
export function computeStenotypingHoursFromTimestampsText(text, idleSeconds = TRANSCRIPT_STENOTYPING_IDLE_SECONDS) {
  const timestamps = extractTimestampsFromText(text);
  if (timestamps.length < 2) return 0;

  const sorted = [...timestamps].sort((a, b) => a - b);
  let activeSeconds = 0;
  let segmentStart = sorted[0];
  let segmentEnd = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index];
    if (next - segmentEnd <= idleSeconds) {
      segmentEnd = next;
    } else {
      activeSeconds += segmentEnd - segmentStart;
      segmentStart = next;
      segmentEnd = next;
    }
  }
  activeSeconds += segmentEnd - segmentStart;

  return Math.round((activeSeconds / 3600) * 100) / 100;
}
