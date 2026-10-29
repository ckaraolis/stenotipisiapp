import { buildAppActionUrl } from './notificationChannels.js';
import { resolveEmailSubject } from './emailSubjects.js';
import { buildEmailRepliesFooter, getEmailRepliesConfig } from './emailConfig.js';

/**
 * §1.1.5 — Brand tokens aligned with the web app (global.css).
 * Inline styles only — email clients do not support external CSS variables.
 */
export const EMAIL_BRAND = Object.freeze({
  productName: 'Stenotipisi',
  organizationName: 'Astraea',
  primary: '#0d9488',
  primaryDark: '#0f766e',
  primarySoft: '#e6f7f5',
  sidebar: '#0f172a',
  background: '#f1f5f9',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  textOnDark: '#f8fafc',
  danger: '#dc2626',
  fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  fontDisplay: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

/**
 * §1.1.5 — Standard HTML email shell matching the application look.
 */
export function renderEmailDocument({
  subject = '',
  preheader = '',
  title = '',
  introHtml = '',
  details = [],
  instructionsHtml = '',
  primaryAction = null,
  secondaryAction = null,
  footerNote = '',
  repliesFooterHtml = '',
} = {}) {
  const brand = EMAIL_BRAND;
  const detailRows = (Array.isArray(details) ? details : [])
    .filter((row) => row && (row.label || row.value))
    .map(
      (row) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.textMuted};font-size:13px;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
                <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.text};font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(row.value)}</td>
              </tr>`,
    )
    .join('');

  const detailsBlock = detailRows
    ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">
            ${detailRows}
          </table>`
    : '';

  const primaryButton =
    primaryAction?.url && primaryAction?.label
      ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
            <tr>
              <td style="border-radius:8px;background:linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%);">
                <a href="${escapeAttr(primaryAction.url)}" style="display:inline-block;padding:12px 20px;color:${brand.textOnDark};text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(primaryAction.label)}</a>
              </td>
            </tr>
          </table>`
      : '';

  const secondaryLink =
    secondaryAction?.url && secondaryAction?.label
      ? `<p style="margin:0 0 8px;font-size:13px;"><a href="${escapeAttr(secondaryAction.url)}" style="color:${brand.primary};font-weight:600;text-decoration:none;">${escapeHtml(secondaryAction.label)}</a></p>`
      : '';

  const instructionsBlock = instructionsHtml
    ? `
          <div style="margin:0 0 20px;padding:14px 16px;border-radius:8px;background:${brand.primarySoft};border:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${brand.primaryDark};">What to do next</p>
            <div style="margin:0;font-size:14px;line-height:1.55;color:${brand.text};">${instructionsHtml}</div>
          </div>`
    : '';

  const repliesBlock = repliesFooterHtml
    ? `
              <div style="margin:0 0 12px;padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid ${brand.border};">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${brand.textMuted};">Replies</p>
                <div style="margin:0;font-size:12px;line-height:1.55;color:${brand.textMuted};">${repliesFooterHtml}</div>
              </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject || title || brand.productName)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.background};color:${brand.text};font-family:${brand.fontFamily};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.background};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${brand.surface};border:1px solid ${brand.border};border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:18px 24px;background:linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%);">
              <p style="margin:0;font-family:${brand.fontDisplay};font-size:20px;font-weight:700;color:${brand.textOnDark};letter-spacing:0.01em;">${escapeHtml(brand.productName)}</p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(248,250,252,0.85);">${escapeHtml(brand.organizationName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 12px;font-family:${brand.fontDisplay};font-size:22px;line-height:1.3;color:${brand.text};">${escapeHtml(title || subject)}</h1>
              <div style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${brand.text};">${introHtml}</div>
              ${detailsBlock}
              ${instructionsBlock}
              ${primaryButton}
              ${secondaryLink}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid ${brand.border};">
              ${repliesBlock}
              <p style="margin:0;font-size:12px;line-height:1.5;color:${brand.textMuted};">
                ${escapeHtml(footerNote || `This message was sent by ${brand.productName}. If you were not expecting it, you can ignore this email.`)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraphHtml(text) {
  const escaped = escapeHtml(text).replace(/\n/g, '<br />');
  return `<p style="margin:0 0 12px;">${escaped}</p>`;
}

/**
 * Default next-step instructions per notification type (§1.1.4).
 * Later specification sections may refine these texts.
 */
const EMAIL_INSTRUCTIONS_BY_TYPE = {
  job_assigned: 'Sign in to review the assignment details and prepare for the scheduled job.',
  job_unassigned: 'Sign in if you need to confirm your updated schedule.',
  job_rejected: 'Sign in to review the rejection details and take any required follow-up action.',
  job_confirmed: 'Sign in to view the confirmed assignment on your schedule.',
  job_created: 'Sign in to review the new job and continue the scheduling workflow.',
  job_approved: 'Sign in to confirm the approved job details.',
  job_provisionally_assigned: 'Sign in to confirm or manage the provisional assignment.',
  jobs_confirmed_all: 'Sign in to review the confirmed job assignments.',
  job_submission_completed: 'Sign in to review the completed submission and related transcript.',
  stenotypist_leave_submitted: 'Sign in to review and approve or reject the leave request.',
  stenotypist_leave_approved: 'Sign in to view your approved leave on the schedule.',
  stenotypist_leave_rejected: 'Sign in to review the leave decision and contact your coordinator if needed.',
  transcript_created: 'Sign in to open the transcript and continue the workflow.',
  transcript_editor_assigned: 'Sign in to open the transcript and begin editing.',
  transcript_reviewer_assigned: 'Sign in to open the transcript and begin review.',
  transcript_edited_submitted: 'Sign in to review the edited transcript.',
  transcript_reviewed_submitted: 'Sign in to publish or continue the transcript workflow.',
  transcript_published: 'Sign in to view the published transcript.',
  transcript_published_bypass: 'Sign in to view the published transcript.',
  password_reset: 'Use the secure link below to choose a new password. The link expires in about one hour.',
  password_changed: 'If you did not change your password, sign in and contact an administrator immediately.',
  account_email_changed: 'Use your new email address the next time you sign in.',
  account_email_changed_old: 'Use your new email address the next time you sign in.',
  account_email_changed_new: 'Use this email address the next time you sign in.',
};

const EMAIL_PRIMARY_ACTION_LABEL_BY_TYPE = {
  password_reset: 'Reset password',
  password_changed: 'Sign in',
  account_email_changed: 'Sign in',
  account_email_changed_old: 'Sign in',
  account_email_changed_new: 'Sign in',
  transcript_editor_assigned: 'Open transcript',
  transcript_reviewer_assigned: 'Open transcript',
  transcript_edited_submitted: 'Open transcript',
  transcript_reviewed_submitted: 'Open transcript',
  transcript_published: 'Open transcript',
  transcript_published_bypass: 'Open transcript',
  transcript_created: 'Open transcript',
  stenotypist_leave_submitted: 'Open leave requests',
  stenotypist_leave_approved: 'Open leave requests',
  stenotypist_leave_rejected: 'Open leave requests',
  job_assigned: 'Open jobs',
  job_unassigned: 'Open jobs',
  job_rejected: 'Open jobs',
  job_confirmed: 'Open jobs',
  job_created: 'Open jobs',
  job_approved: 'Open jobs',
  job_provisionally_assigned: 'Open job allocation',
  jobs_confirmed_all: 'Open job allocation',
  job_submission_completed: 'Open jobs',
};

/**
 * §1.1.4 — Build plain-text + HTML bodies for a notification email.
 */
export function buildNotificationEmailContent({
  messageType = '',
  message = '',
  actionUrl = '',
  details = [],
  instructions = '',
  recipientName = '',
  primaryActionLabel = '',
} = {}) {
  const type = typeof messageType === 'string' ? messageType.trim() : '';
  const subject = resolveEmailSubject(type);
  const loginUrl = buildAppActionUrl('/signin');
  const resolvedActionUrl =
    (typeof actionUrl === 'string' && actionUrl.trim()) || loginUrl;
  const intro =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : subject;
  const resolvedInstructions =
    (typeof instructions === 'string' && instructions.trim()) ||
    EMAIL_INSTRUCTIONS_BY_TYPE[type] ||
    'Sign in to the application to review this notification and continue.';

  const detailRows = Array.isArray(details)
    ? details.filter((row) => row && String(row.value ?? '').trim() !== '')
    : [];

  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const introHtml = `${paragraphHtml(greeting)}${paragraphHtml(intro)}`;
  const instructionsHtml = escapeHtml(resolvedInstructions).replace(/\n/g, '<br />');

  const primaryLabel =
    primaryActionLabel ||
    EMAIL_PRIMARY_ACTION_LABEL_BY_TYPE[type] ||
    'Open in application';

  const replies = getEmailRepliesConfig();
  const repliesFooter = buildEmailRepliesFooter(replies);
  const repliesFooterHtml = repliesFooter.htmlLines
    .map((line) => escapeHtml(line))
    .join('<br />');

  const html = renderEmailDocument({
    subject,
    preheader: intro,
    title: subject,
    introHtml,
    details: detailRows,
    instructionsHtml,
    primaryAction: {
      label: primaryLabel,
      url: resolvedActionUrl,
    },
    secondaryAction: {
      label: 'Go to login page',
      url: loginUrl,
    },
    repliesFooterHtml,
  });

  const plainLines = [
    recipientName ? `Hello ${recipientName},` : 'Hello,',
    '',
    intro,
  ];

  if (detailRows.length > 0) {
    plainLines.push('', 'Details:');
    for (const row of detailRows) {
      plainLines.push(`- ${row.label}: ${row.value}`);
    }
  }

  plainLines.push('', 'What to do next:', resolvedInstructions, '');
  plainLines.push(`${primaryLabel}: ${resolvedActionUrl}`);
  plainLines.push(`Login page: ${loginUrl}`);
  plainLines.push('', 'Replies:', repliesFooter.plain);

  return {
    subject,
    text: plainLines.join('\n').trim(),
    html,
    actionUrl: resolvedActionUrl,
    loginUrl,
  };
}
