/**
 * SMS notification delivery (console mock until an SMS gateway is configured).
 * Used for scheduling notifications so stenotypists see assignments offline.
 */
export function deliverSmsNotification({
  to = '',
  message = '',
} = {}) {
  const recipient = typeof to === 'string' ? to.trim() : '';
  if (!recipient) {
    return { sent: false, skipped: true, reason: 'mobilePhoneMissing' };
  }

  const body = String(message ?? '').trim();
  console.log(`[Notification SMS] To: ${recipient}\n${body}`);

  return {
    sent: true,
    channel: 'sms',
    to: recipient,
    message: body,
  };
}
