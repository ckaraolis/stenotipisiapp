import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getEmailConfig, resolveEmailReplyToHeader, resolveEmailSender } from './emailConfig.js';
import { buildNotificationEmailContent } from './emailDesign.js';
import { resolveEmailSubject } from './emailSubjects.js';

async function sendViaPostageApp({ to, subject, text, html, config, fromHeader, replyTo, attachments = [] }) {
  if (!config.postageapp.apiKey) {
    return { sent: false, skipped: true, reason: 'postageappApiKeyMissing' };
  }

  const uid = `stenotipisi-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const headers = {
    subject,
    from: fromHeader,
  };
  if (replyTo) {
    headers['reply-to'] = replyTo;
  }

  const argumentsPayload = {
    recipients: [to],
    headers,
    content: {
      'text/plain': text,
      'text/html': html,
    },
  };

  if (config.postageapp.template) {
    argumentsPayload.template = config.postageapp.template;
  }
  if (config.postageapp.recipientOverride) {
    argumentsPayload.recipient_override = config.postageapp.recipientOverride;
  }
  if (Array.isArray(attachments) && attachments.length > 0) {
    // PostageApp accepts base64 attachments keyed by filename.
    const files = {};
    for (const file of attachments) {
      if (!file?.filename || !file?.content) continue;
      const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
      files[file.filename] = {
        content_type: file.contentType || 'application/octet-stream',
        content: buffer.toString('base64'),
      };
    }
    if (Object.keys(files).length > 0) {
      argumentsPayload.attachments = files;
    }
  }

  const response = await fetch(config.postageapp.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.postageapp.apiKey,
      uid,
      arguments: argumentsPayload,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const status = payload?.response?.status ?? '';
  if (!response.ok || (status && status !== 'ok')) {
    const detail =
      payload?.response?.message ||
      `PostageApp request failed with HTTP ${response.status}`;
    console.error(`[Email PostageApp] Failed to ${to}: ${detail}`);
    return {
      sent: false,
      channel: 'email',
      provider: 'postageapp',
      to,
      subject,
      from: fromHeader,
      replyTo: replyTo || '',
      error: detail,
    };
  }

  console.log(
    `[Email PostageApp] From ${fromHeader}${replyTo ? ` (Reply-To ${replyTo})` : ''} → ${to} — ${subject}`,
  );
  return {
    sent: true,
    channel: 'email',
    provider: 'postageapp',
    to,
    subject,
    from: fromHeader,
    replyTo: replyTo || '',
    messageId: payload?.data?.message?.id ?? uid,
  };
}

async function sendViaSmtp({ to, subject, text, html, config, fromHeader, replyTo, attachments = [] }) {
  if (!config.smtp.host) {
    return { sent: false, skipped: true, reason: 'smtpHostMissing' };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth:
      config.smtp.user || config.smtp.pass
        ? {
            user: config.smtp.user,
            pass: config.smtp.pass,
          }
        : undefined,
  });

  const mailAttachments = (Array.isArray(attachments) ? attachments : [])
    .filter((file) => file?.filename && file?.content)
    .map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType || undefined,
      cid: file.cid || undefined,
    }));

  const info = await transporter.sendMail({
    from: fromHeader,
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(mailAttachments.length > 0 ? { attachments: mailAttachments } : {}),
  });

  console.log(
    `[Email SMTP] From ${fromHeader}${replyTo ? ` (Reply-To ${replyTo})` : ''} → ${to} — ${subject} (${info.messageId || 'ok'})`,
  );
  return {
    sent: true,
    channel: 'email',
    provider: 'smtp',
    to,
    subject,
    from: fromHeader,
    replyTo: replyTo || '',
    messageId: info.messageId || '',
  };
}

function sendViaConsole({ to, subject, text, fromHeader, replyTo }) {
  console.log(
    `[Email Console] From: ${fromHeader}${replyTo ? `\nReply-To: ${replyTo}` : ''}\nTo: ${to}\nSubject: ${subject}\n${text}`,
  );
  return {
    sent: true,
    channel: 'email',
    provider: 'console',
    to,
    subject,
    from: fromHeader,
    replyTo: replyTo || '',
  };
}

/**
 * §1.1 — Send an email to the recipient Email Address.
 * §1.1.2 — Sender identity · §1.1.3 — fixed Subject · §1.1.4/1.1.5 — branded Body.
 */
export async function deliverEmailNotification({
  to = '',
  subject = '',
  message = '',
  actionUrl = '',
  sender = null,
  senderKey = '',
  messageType = '',
  details = [],
  instructions = '',
  recipientName = '',
  primaryActionLabel = '',
  html = '',
  text = '',
  attachments = [],
} = {}) {
  const recipient = typeof to === 'string' ? to.trim() : '';
  if (!recipient) {
    return { sent: false, skipped: true, reason: 'emailMissing' };
  }

  const config = getEmailConfig();
  const resolvedSender = resolveEmailSender({
    sender,
    senderKey,
    messageType,
    config,
  });
  const fromHeader = resolvedSender.header || config.fromHeader;
  const replyTo = resolveEmailReplyToHeader(config.replies);

  const content =
    html && text
      ? {
          subject: resolveEmailSubject(messageType, subject),
          text,
          html,
          actionUrl,
        }
      : buildNotificationEmailContent({
          messageType,
          message,
          actionUrl,
          details,
          instructions,
          recipientName,
          primaryActionLabel,
        });

  const resolvedSubject = content.subject || resolveEmailSubject(messageType, subject);
  const payload = {
    to: recipient,
    subject: resolvedSubject,
    text: content.text,
    html: content.html,
    config,
    fromHeader,
    replyTo,
    attachments: Array.isArray(attachments) ? attachments : [],
  };

  try {
    if (config.provider === 'postageapp') {
      return await sendViaPostageApp(payload);
    }
    if (config.provider === 'smtp') {
      return await sendViaSmtp(payload);
    }
    return sendViaConsole(payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[Email ${config.provider}] Failed to ${recipient}: ${detail}`);
    return {
      sent: false,
      channel: 'email',
      provider: config.provider,
      to: recipient,
      subject: resolvedSubject,
      from: fromHeader,
      error: detail,
    };
  }
}

export function getActiveEmailProvider() {
  return getEmailConfig().provider;
}
