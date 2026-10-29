/**
 * §1.1.3 — Email subjects by notification type.
 *
 * Subjects must relate to the notification type and must not be parameterised
 * (PostageApp cannot inject values such as job numbers into the Subject).
 * Job / transcript identifiers belong in the email body and Online Notification message.
 *
 * Per-type wording may be refined in later specification sections; keep subjects fixed strings.
 */
export const EMAIL_SUBJECTS_BY_TYPE = Object.freeze({
  // Scheduling
  job_created: 'Job Created',
  job_assigned: 'Job Assigned',
  job_unassigned: 'Job Unassigned',
  job_provisionally_assigned: 'Job Provisionally Assigned',
  job_approved: 'Job Approved',
  job_rejected: 'Job Rejected',
  job_confirmed: 'Job Confirmed',
  jobs_confirmed_all: 'Jobs Confirmed',
  job_submission_completed: 'Job Submission Completed',
  stenotypist_leave_submitted: 'Stenotypist Leave Submitted',
  stenotypist_leave_approved: 'Stenotypist Leave Approved',
  stenotypist_leave_rejected: 'Stenotypist Leave Rejected',

  // Transcripts
  transcript_created: 'Transcript Created',
  transcript_editor_assigned: 'Transcript Editor Assigned',
  transcript_reviewer_assigned: 'Transcript Reviewer Assigned',
  transcript_edited_submitted: 'Edited Transcript Submitted',
  transcript_reviewed_submitted: 'Reviewed Transcript Submitted',
  transcript_published: 'Transcript Published',
  transcript_published_bypass: 'Transcript Published',

  // Account / access
  password_reset: 'Password Reset',
  password_changed: 'Password Changed',
  account_email_changed: 'Account Email Changed',
  account_email_changed_old: 'Account Email Changed',
  account_email_changed_new: 'Account Email Changed',
});

const DEFAULT_EMAIL_SUBJECT = 'Stenotipisi Notification';

/**
 * Resolve a fixed Subject for the notification type.
 * Ignores any parameterised override so PostageApp (and other providers) stay compliant.
 */
export function resolveEmailSubject(messageType = '', _ignoredOverride = '') {
  const type = typeof messageType === 'string' ? messageType.trim() : '';
  if (type && EMAIL_SUBJECTS_BY_TYPE[type]) {
    return EMAIL_SUBJECTS_BY_TYPE[type];
  }
  return DEFAULT_EMAIL_SUBJECT;
}

export function listEmailSubjectDefinitions() {
  return Object.entries(EMAIL_SUBJECTS_BY_TYPE).map(([type, subject]) => ({ type, subject }));
}
