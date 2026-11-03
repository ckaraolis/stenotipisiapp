import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

let envFileLoaded = false;

/** Load `.env` into process.env without overriding existing values. */
export function loadEmailEnvFile() {
  if (envFileLoaded) return;
  envFileLoaded = true;
  if (!fs.existsSync(ENV_PATH)) return;

  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function env(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/**
 * §1.1.2 — Format sender as `Display Name <email@domain>`.
 * A registered client domain (e.g. stenotypisi.com) is advisable for deliverability.
 */
export function formatEmailSenderHeader(name, email) {
  const address = typeof email === 'string' ? email.trim() : '';
  const displayName = typeof name === 'string' ? name.trim() : '';
  if (!address) return '';
  if (!displayName) return address;
  return `${displayName} <${address}>`;
}

function normalizeSender(input = {}) {
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!email) return null;
  return {
    name,
    email,
    header: formatEmailSenderHeader(name, email),
  };
}

function parseSendersJson() {
  const raw = env('EMAIL_SENDERS');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const senders = {};
    for (const [key, value] of Object.entries(parsed)) {
      const sender = normalizeSender(value ?? {});
      if (sender) senders[key] = sender;
    }
    return senders;
  } catch (error) {
    console.error('[Email Config] Invalid EMAIL_SENDERS JSON:', error);
    return {};
  }
}

function collectNamedSendersFromEnv() {
  const senders = {};
  const prefix = 'EMAIL_SENDER_';
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || !key.endsWith('_EMAIL')) continue;
    const slug = key.slice(prefix.length, -'_EMAIL'.length).toLowerCase();
    if (!slug || !value?.trim()) continue;
    const name = env(`${prefix}${slug.toUpperCase()}_NAME`) || env('EMAIL_FROM_NAME') || 'Astraea';
    const sender = normalizeSender({ name, email: value });
    if (sender) senders[slug] = sender;
  }
  return senders;
}

/**
 * §1.1.2 — Built-in sender profiles. Override via env; final addresses can be decided later.
 * Default example style: Astraea <admin@stenotypisi.com>
 */
export const EMAIL_SENDER_KEYS = ['default', 'admin', 'scheduling', 'transcripts', 'account'];

/**
 * Map notification / message categories to a sender profile when none is specified.
 */
export function resolveSenderKeyForMessageType(messageType = '') {
  const type = typeof messageType === 'string' ? messageType.trim() : '';
  if (
    type.startsWith('job_') ||
    type.startsWith('jobs_') ||
    type.startsWith('stenotypist_leave_')
  ) {
    return 'scheduling';
  }
  if (type.startsWith('transcript_')) {
    return 'transcripts';
  }
  if (
    type.startsWith('password_') ||
    type.startsWith('account_') ||
    type.startsWith('user_') ||
    type === 'user_created' ||
    type === 'user_updated' ||
    type === 'user_mfa_setup'
  ) {
    return 'account';
  }
  return 'default';
}

/**
 * §1.1.1 — Email delivery configuration.
 * Providers:
 * - postageapp (recommended specialist online service)
 * - smtp (application's own SMTP server)
 * - console (local development / unconfigured fallback)
 *
 * §1.1.2 — Sender identity supports a default From plus optional per-message senders.
 */
export function getEmailConfig() {
  loadEmailEnvFile();

  const explicitProvider = env('EMAIL_PROVIDER').toLowerCase();
  const postageApiKey = env('POSTAGEAPP_API_KEY');
  const smtpHost = env('SMTP_HOST');

  let provider = explicitProvider;
  if (!provider) {
    if (postageApiKey) provider = 'postageapp';
    else if (smtpHost) provider = 'smtp';
    else provider = 'console';
  }

  if (!['postageapp', 'smtp', 'console'].includes(provider)) {
    provider = 'console';
  }

  const fromEmail =
    env('EMAIL_FROM_EMAIL') ||
    env('POSTAGEAPP_FROM_EMAIL') ||
    env('SMTP_FROM_EMAIL') ||
    'admin@stenotypisi.com';
  const fromName =
    env('EMAIL_FROM_NAME') ||
    env('POSTAGEAPP_FROM_NAME') ||
    env('SMTP_FROM_NAME') ||
    'Astraea';

  const defaultSender =
    normalizeSender({ name: fromName, email: fromEmail }) ||
    normalizeSender({ name: 'Astraea', email: 'admin@stenotypisi.com' });

  const senders = {
    default: defaultSender,
    admin: defaultSender,
    scheduling: defaultSender,
    transcripts: defaultSender,
    account: defaultSender,
    ...parseSendersJson(),
    ...collectNamedSendersFromEnv(),
  };

  // Ensure default/admin always resolve even if JSON overwrote incompletely.
  if (!senders.default) senders.default = defaultSender;
  if (!senders.admin) senders.admin = senders.default;

  return {
    provider,
    fromEmail: senders.default.email,
    fromName: senders.default.name,
    fromHeader: senders.default.header,
    senders,
    replies: getEmailRepliesConfig(),
    postageapp: {
      apiKey: postageApiKey,
      apiUrl: env(
        'POSTAGEAPP_API_URL',
        'https://api.postageapp.com/v.1.0/send_message.json',
      ),
      recipientOverride: env('POSTAGEAPP_RECIPIENT_OVERRIDE'),
      template: env('POSTAGEAPP_TEMPLATE'),
    },
    smtp: {
      host: smtpHost,
      port: Number(env('SMTP_PORT', '587')) || 587,
      secure: env('SMTP_SECURE', 'false').toLowerCase() === 'true',
      user: env('SMTP_USER'),
      pass: env('SMTP_PASS'),
    },
  };
}

/**
 * §1.1.7 — Replies policy.
 * Option A (`unmonitored`): From address is not monitored; emails note this and list admin contact.
 * Option B (`monitored`): Reply-To uses a monitored address; client monitors it.
 */
export function getEmailRepliesConfig() {
  loadEmailEnvFile();

  const raw = env('EMAIL_REPLY_MODE', 'monitored').toLowerCase();
  const mode =
    raw === 'unmonitored' || raw === 'option_a' || raw === 'a'
      ? 'unmonitored'
      : 'monitored';

  const adminContact = {
    name: env('EMAIL_ADMIN_CONTACT_NAME', 'System Administrator'),
    email: env('EMAIL_ADMIN_CONTACT_EMAIL') || env('EMAIL_FROM_EMAIL', 'admin@stenotypisi.com'),
    telephone: env('EMAIL_ADMIN_CONTACT_TELEPHONE', ''),
  };

  const monitoredReplyTo =
    env('EMAIL_MONITORED_REPLY_TO') ||
    adminContact.email ||
    env('EMAIL_FROM_EMAIL', 'admin@stenotypisi.com');

  return {
    mode,
    adminContact,
    /** Option B — address used as Reply-To when replies are monitored. */
    monitoredReplyTo,
    /**
     * Option A — optional Reply-To that should also be unmonitored (e.g. noreply@…).
     * If empty, no Reply-To header is set.
     */
    unmonitoredReplyTo: env('EMAIL_UNMONITORED_REPLY_TO'),
  };
}

export function resolveEmailReplyToHeader(replies = getEmailRepliesConfig()) {
  if (replies.mode === 'monitored') {
    return replies.monitoredReplyTo || '';
  }
  return replies.unmonitoredReplyTo || '';
}

/** Plain-text + HTML footer copy for §1.1.7. */
export function buildEmailRepliesFooter(replies = getEmailRepliesConfig()) {
  if (replies.mode === 'monitored') {
    const address = replies.monitoredReplyTo || 'the monitored support address';
    const plain = [
      'You may reply to this email. Replies are delivered to a monitored mailbox maintained by the client organisation.',
      `Monitored address: ${address}`,
    ].join('\n');
    return { plain, htmlLines: [plain] };
  }

  const { name, email, telephone } = replies.adminContact;
  const lines = [
    'Please do not reply to this email. The sending address is not monitored and replies will not be noticed.',
    'For assistance, contact the administrator:',
  ];
  if (name) lines.push(`Name: ${name}`);
  if (email) lines.push(`Email Address: ${email}`);
  if (telephone) lines.push(`Telephone Number: ${telephone}`);

  return { plain: lines.join('\n'), htmlLines: lines };
}

/**
 * Resolve a sender by key, explicit { name, email }, or message type.
 * Falls back to the default Astraea <admin@…> style sender.
 */
export function resolveEmailSender({
  sender = null,
  senderKey = '',
  messageType = '',
  config = null,
} = {}) {
  const emailConfig = config || getEmailConfig();

  if (sender && typeof sender === 'object') {
    const explicit = normalizeSender(sender);
    if (explicit) return explicit;
  }

  const key =
    (typeof sender === 'string' && sender.trim()) ||
    (typeof senderKey === 'string' && senderKey.trim()) ||
    resolveSenderKeyForMessageType(messageType) ||
    'default';

  return emailConfig.senders[key] || emailConfig.senders.default;
}

export function describeEmailSetupGuidance() {
  return {
    recommendedProvider: 'postageapp',
    providerHome: 'https://www.postageapp.com',
    recommendedSenderExample: 'Astraea <admin@stenotypisi.com>',
    replyModes: {
      optionA: 'unmonitored',
      optionB: 'monitored',
    },
    notes: [
      'Create a dedicated PostageApp account/project for this application.',
      'Running costs (currently about $9/month) should be covered by the client.',
      'Configure DNS (SPF/DKIM/DMARC) with the client DNS registrar for deliverability.',
      'Emails are always sent to the Email Address defined on the relevant User record.',
      'Prefer a registered domain belonging to the client for the From address.',
      'Multiple sender addresses can be configured for different message categories.',
      '§1.1.7 Option A: unmonitored From — note in every email and list admin Name / Email / Telephone.',
      '§1.1.7 Option B: monitored Reply-To — client assumes responsibility for monitoring.',
    ],
  };
}
