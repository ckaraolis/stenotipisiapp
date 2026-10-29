import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS_PER_PAGE_CONSTANT } from './jobMatrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_PATH = path.join(__dirname, '..', 'database', 'jobSubmissions.json');

/** Client-defined minutes per transcript page for ETE (§2.4). */
export const TRANSCRIPT_ETE_MINUTES_PER_PAGE = 15;

function readSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(SUBMISSIONS_PATH, 'utf8'));
  return data.submissions ?? [];
}

function countBillableTranscriptCharacters(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  let plain = text;
  if (plain.includes('{\\rtf')) {
    plain = plain
      .replace(/\\[a-z]+-?\d* ?/gi, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/\\'[0-9a-f]{2}/gi, ' ');
  }
  plain = plain
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\bSPEAKER\s*\d*:?/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '');
  return plain.length;
}

export { countBillableTranscriptCharacters };

export function getTranscriptPageCountForJob(jobId) {
  const submission = readSubmissions().find((row) => row.jobId === jobId) ?? null;
  const explicitCount = Number(submission?.transcriptCharacterCount);
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return Math.round(explicitCount / CHARACTERS_PER_PAGE_CONSTANT);
  }
  const plainText =
    typeof submission?.transcriptPlainText === 'string' ? submission.transcriptPlainText : '';
  if (plainText) {
    return Math.round(countBillableTranscriptCharacters(plainText) / CHARACTERS_PER_PAGE_CONSTANT);
  }
  return 0;
}

export function computeTranscriptEteMinutes(pageCount) {
  const pages = Number.isFinite(pageCount) ? pageCount : 0;
  return pages * TRANSCRIPT_ETE_MINUTES_PER_PAGE;
}
