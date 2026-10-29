import { dispatchNotification } from './notifications.js';
import { deliverEmailNotification } from './emailDelivery.js';
import { buildAppActionUrl } from './notificationChannels.js';

/**
 * §1.1 — Email change notices go to the previous and new Email Addresses
 * defined for the user (via PostageApp / SMTP / console).
 */
export async function sendAccountEmailChangeNotifications({
  user,
  oldEmail,
  newEmail,
  actorUserId,
}) {
  const loginPath = buildAppActionUrl('/signin');

  await deliverEmailNotification({
    to: oldEmail,
    message:
      'Your account email has changed. All further notifications will be sent to your new address, effective immediately.',
    actionUrl: loginPath,
    senderKey: 'account',
    messageType: 'account_email_changed_old',
    recipientName: user.fullName,
    details: [
      { label: 'Previous Email', value: oldEmail },
      { label: 'New Email', value: newEmail },
    ],
    instructions:
      `To log in to the application you will need to use ${newEmail}. Your previous address (${oldEmail}) will no longer receive application emails.`,
  });

  await deliverEmailNotification({
    to: newEmail,
    message:
      'Your account email has changed. You will need to use this address to log in to the service.',
    actionUrl: loginPath,
    senderKey: 'account',
    messageType: 'account_email_changed_new',
    recipientName: user.fullName,
    details: [
      { label: 'Previous Email', value: oldEmail },
      { label: 'New Email', value: newEmail },
    ],
    instructions:
      `Use ${newEmail} the next time you sign in. Your old email account (${oldEmail}) has been unsubscribed from the application.`,
  });

  await dispatchNotification({
    type: 'account_email_changed_old',
    message: `Email change notice sent to previous address ${oldEmail} for user ${user.fullName}.`,
    targetUserId: user.id,
    createdByUserId: actorUserId,
    actionPath: '/administration/account-management',
    channels: ['online'],
  });

  await dispatchNotification({
    type: 'account_email_changed_new',
    message: `Email change notice sent to new address ${newEmail} for user ${user.fullName}.`,
    targetUserId: user.id,
    createdByUserId: actorUserId,
    actionPath: '/administration/account-management',
    channels: ['online'],
  });

  return { sent: true };
}
