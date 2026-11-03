import QRCode from 'qrcode';
import { buildTotpOtpAuthUrl } from './totp.js';
import { buildAppActionUrl } from './notificationChannels.js';
import { renderEmailDocument, EMAIL_BRAND } from './emailDesign.js';
import { buildEmailRepliesFooter, getEmailRepliesConfig } from './emailConfig.js';
import { resolveEmailSubject } from './emailSubjects.js';
import { deliverEmailNotification } from './emailDelivery.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build MFA enrollment assets: otpauth URL + QR (data URI + PNG buffer).
 */
export async function buildMfaEnrollmentAssets({ email, totpSecret }) {
  const otpauthUrl = buildTotpOtpAuthUrl({ email, secret: totpSecret });
  if (!otpauthUrl) {
    return { otpauthUrl: '', qrDataUrl: '', qrPngBuffer: null };
  }

  const [qrDataUrl, qrPngBuffer] = await Promise.all([
    QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#0f172a', light: '#ffffff' },
    }),
    QRCode.toBuffer(otpauthUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#0f172a', light: '#ffffff' },
    }),
  ]);

  return { otpauthUrl, qrDataUrl, qrPngBuffer };
}

function buildEnrollmentEmailContent({
  user,
  totpSecret,
  temporaryPassword = '',
  otpauthUrl,
  qrDataUrl,
}) {
  const brand = EMAIL_BRAND;
  const signInUrl = buildAppActionUrl('/signin');
  const subject = resolveEmailSubject('user_mfa_setup');
  const replies = getEmailRepliesConfig();

  const qrBlock = qrDataUrl
    ? `
          <div style="margin:0 0 20px;text-align:center;">
            <p style="margin:0 0 10px;font-size:13px;color:${brand.textMuted};">Scan this QR code with Google Authenticator, Microsoft Authenticator, or a similar app:</p>
            <img src="${qrDataUrl}" alt="MFA QR code" width="220" height="220" style="display:inline-block;border:1px solid ${brand.border};border-radius:12px;padding:8px;background:#fff;" />
          </div>`
    : '';

  const passwordRow = temporaryPassword
    ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.textMuted};font-size:13px;width:38%;">Temporary password</td>
                <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.text};font-size:14px;font-weight:700;font-family:Consolas,monospace;">${escapeHtml(temporaryPassword)}</td>
              </tr>`
    : '';

  const introHtml = `
          <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${brand.text};">
            An account has been created for you on <strong>${escapeHtml(brand.productName)}</strong>.
            Sign in with your email, then complete two-factor authentication using an authenticator app.
          </p>`;

  const instructionsHtml = `
          <ol style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:${brand.text};">
            <li>Install Google Authenticator, Microsoft Authenticator, or Authy.</li>
            <li>Tap <strong>Add account</strong> and scan the QR code below (or enter the setup key manually).</li>
            <li>Open <a href="${escapeHtml(signInUrl)}" style="color:${brand.primary};font-weight:600;">${escapeHtml(signInUrl)}</a> and sign in.</li>
            <li>Enter the 6-digit code from your app when prompted.</li>
            ${temporaryPassword ? '<li>You will be asked to change your temporary password on first login.</li>' : ''}
          </ol>
          <p style="margin:14px 0 0;font-size:13px;color:${brand.textMuted};">
            On a phone, you can also open this setup link to add the account automatically:<br/>
            <a href="${escapeHtml(otpauthUrl)}" style="color:${brand.primary};word-break:break-all;">Add to authenticator app</a>
          </p>`;

  const html = renderEmailDocument({
    subject,
    preheader: 'Set up your Stenotipisi account and authenticator app',
    title: 'Welcome — set up your account',
    introHtml,
    details: [
      { label: 'Email', value: user.email },
      { label: 'Username', value: user.username },
      { label: 'Full name', value: user.fullName },
    ],
    instructionsHtml: `${instructionsHtml}${qrBlock}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.textMuted};font-size:13px;width:38%;">Authenticator setup key</td>
              <td style="padding:8px 0;border-bottom:1px solid ${brand.border};color:${brand.text};font-size:14px;font-weight:700;font-family:Consolas,monospace;letter-spacing:0.04em;">${escapeHtml(totpSecret)}</td>
            </tr>
            ${passwordRow}
          </table>
          <p style="margin:8px 0 0;font-size:12px;color:${brand.textMuted};">Keep this email private. Anyone with the setup key can generate your login codes.</p>`,
    primaryAction: { url: signInUrl, label: 'Sign in to Stenotipisi' },
    footerNote: 'If you did not expect this account, contact your administrator.',
    repliesFooterHtml: buildEmailRepliesFooter(replies),
  });

  const text = [
    `Welcome to ${brand.productName}`,
    '',
    `Email: ${user.email}`,
    `Username: ${user.username}`,
    temporaryPassword ? `Temporary password: ${temporaryPassword}` : '',
    '',
    'Set up two-factor authentication:',
    '1. Install Google Authenticator, Microsoft Authenticator, or Authy.',
    '2. Add an account and enter this setup key (or open the otpauth link on your phone):',
    `   ${totpSecret}`,
    otpauthUrl ? `   ${otpauthUrl}` : '',
    '3. Sign in and enter the 6-digit code from the app.',
    temporaryPassword ? '4. Change your temporary password when prompted.' : '',
    '',
    `Sign in: ${signInUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    html,
    text,
    attachments: [],
  };
}

/**
 * Email the new user their login details + MFA QR / setup key.
 * Does not expose secrets in the HTTP API response.
 */
export async function sendUserEnrollmentEmail({
  user,
  totpSecret,
  temporaryPassword = '',
}) {
  if (!user?.email || !totpSecret) {
    return { sent: false, skipped: true, reason: 'missingEnrollmentData' };
  }

  const { otpauthUrl, qrDataUrl, qrPngBuffer } = await buildMfaEnrollmentAssets({
    email: user.email,
    totpSecret,
  });

  const content = buildEnrollmentEmailContent({
    user,
    totpSecret,
    temporaryPassword,
    otpauthUrl,
    qrDataUrl,
  });

  const attachments = qrPngBuffer
    ? [
        {
          filename: 'stenotipisi-mfa-qr.png',
          content: qrPngBuffer,
          contentType: 'image/png',
          cid: 'stenotipisi-mfa-qr',
        },
      ]
    : [];

  // Prefer CID image for SMTP clients that block data-URIs.
  const htmlWithCid =
    attachments.length > 0
      ? content.html.replace(
          /src="data:image\/png;base64,[^"]+"/,
          'src="cid:stenotipisi-mfa-qr"',
        )
      : content.html;

  return deliverEmailNotification({
    to: user.email,
    messageType: 'user_mfa_setup',
    senderKey: 'account',
    recipientName: user.fullName,
    html: htmlWithCid,
    text: content.text,
    subject: content.subject,
    attachments,
  });
}
