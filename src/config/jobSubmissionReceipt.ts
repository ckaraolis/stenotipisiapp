import type { JobSubmissionReceiptData } from '../types/jobSubmission';
import type { TranslationKey } from '../i18n/translations';

const RECEIPT_NUMBER_PATTERN = /^\d{5}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateJobSubmissionReceipt(
  receipt: JobSubmissionReceiptData,
): TranslationKey[] {
  const errors: TranslationKey[] = [];
  const receiptNumber = receipt.receiptNumberStenotypist.trim();
  const startTime = receipt.startTimeStenotypist.trim();
  const endTime = receipt.endTimeStenotypist.trim();

  if (!receiptNumber) {
    errors.push('jobReceiptNumberStenotypistRequired');
  } else if (!RECEIPT_NUMBER_PATTERN.test(receiptNumber)) {
    errors.push('jobReceiptNumberStenotypistInvalid');
  }

  if (!startTime) {
    errors.push('jobStartTimeStenotypistRequired');
  } else if (!TIME_PATTERN.test(startTime)) {
    errors.push('jobStartTimeStenotypistInvalid');
  }

  if (!endTime) {
    errors.push('jobEndTimeStenotypistRequired');
  } else if (!TIME_PATTERN.test(endTime)) {
    errors.push('jobEndTimeStenotypistInvalid');
  }

  if (
    startTime &&
    endTime &&
    TIME_PATTERN.test(startTime) &&
    TIME_PATTERN.test(endTime) &&
    startTime >= endTime
  ) {
    errors.push('jobStenotypistTimeRangeInvalid');
  }

  return errors;
}
