import { sendEmail } from './client';
import { renderRsvpGuestEmail, type RsvpGuestEmailProps } from './templates/rsvp-guest';
import { renderRsvpOwnerEmail, type EmailLinkItem, type EmailMediaItem, type RsvpOwnerEmailProps } from './templates/rsvp-owner';
import { renderContactOwnerEmail, type ContactOwnerEmailProps } from './templates/contact-owner';
import { renderOrderInvoiceEmail, type OrderInvoiceEmailProps } from './templates/order-invoice';
import { renderOrderNotificationEmail, type OrderNotificationEmailProps } from './templates/order-notification';
import { renderWelcomeEmail, type WelcomeEmailProps, type WelcomeLinkItem, type WelcomeMediaItem } from './templates/welcome';
import { renderNewsletterEmail, type NewsletterEmailProps, type NewsletterLinkItem, type NewsletterMediaItem } from './templates/newsletter';
import { renderReminderEmail, type ReminderEmailProps } from './templates/reminder';
import { renderMeetingTriggerEmail, type MeetingTriggerEmailProps, type MeetingTriggerType } from './templates/meeting-trigger';

export type {
  RsvpGuestEmailProps,
  EmailLinkItem,
  EmailMediaItem,
  RsvpOwnerEmailProps,
  ContactOwnerEmailProps,
  OrderInvoiceEmailProps,
  OrderNotificationEmailProps,
  WelcomeEmailProps,
  WelcomeLinkItem,
  WelcomeMediaItem,
  NewsletterEmailProps,
  NewsletterLinkItem,
  NewsletterMediaItem,
  ReminderEmailProps,
  MeetingTriggerEmailProps,
  MeetingTriggerType,
};

export {
  sendEmail,
  renderRsvpGuestEmail,
  renderRsvpOwnerEmail,
  renderContactOwnerEmail,
  renderOrderInvoiceEmail,
  renderOrderNotificationEmail,
  renderWelcomeEmail,
  renderNewsletterEmail,
  renderReminderEmail,
  renderMeetingTriggerEmail,
};

export async function sendReminderEmail(
  to: string,
  data: ReminderEmailProps
): Promise<void> {
  const html = await renderReminderEmail(data);
  await sendEmail({
    to,
    subject: `Starting soon — ${data.meetingTitle}`,
    html,
    fromName: data.orgName,
  });
}

export async function sendMeetingTriggerEmail(
  to: string,
  data: MeetingTriggerEmailProps
): Promise<void> {
  const html = await renderMeetingTriggerEmail(data);
  const subject = data.type === 'cancellation'
    ? `Cancelled — ${data.meetingTitle}`
    : data.type === 'confirmation'
      ? `Confirmed — ${data.meetingTitle}`
      : `Reminder — ${data.meetingTitle}`;
  await sendEmail({
    to,
    subject,
    html,
  });
}

export async function sendRsvpConfirmation(
  to: string,
  data: RsvpGuestEmailProps
): Promise<void> {
  const html = await renderRsvpGuestEmail(data);
  await sendEmail({
    to,
    subject: `RSVP Confirmed — ${data.meetingTitle}`,
    html,
    fromName: data.orgName,
  });
}

export async function sendRsvpNotification(
  to: string,
  data: RsvpOwnerEmailProps
): Promise<void> {
  const html = await renderRsvpOwnerEmail(data);
  const subjectPrefix = data.variant === 'reconfirmed' ? 'Confirmed' : 'New RSVP';
  await sendEmail({
    to,
    subject: `${subjectPrefix}: ${data.guestName} — ${data.meetingTitle}`,
    html,
    ...(data.guestEmail ? { replyTo: data.guestEmail } : {}),
  });
}

export async function sendContactNotification(
  to: string,
  data: ContactOwnerEmailProps
): Promise<void> {
  const html = await renderContactOwnerEmail(data);
  await sendEmail({
    to,
    subject: `Contact form: ${data.senderName} — ${data.orgName ?? 'Elkdonis Arts Collective'}`,
    html,
    replyTo: data.senderEmail,
  });
}

export async function sendOrderInvoice(
  to: string,
  data: OrderInvoiceEmailProps
): Promise<void> {
  const html = await renderOrderInvoiceEmail(data);
  await sendEmail({
    to,
    subject: `Action required: complete your purchase — Order ${data.orderNumber}`,
    html,
    fromName: 'Art-Auction',
  });
}

export async function sendOrderNotification(
  to: string,
  data: OrderNotificationEmailProps
): Promise<void> {
  const html = await renderOrderNotificationEmail(data);
  const subject = data.role === 'artist'
    ? `Sale pending — Order ${data.orderNumber}`
    : `New sale — Order ${data.orderNumber}`;
  await sendEmail({
    to,
    subject,
    html,
    fromName: 'Art-Auction',
    replyTo: data.customerEmail,
  });
}

export async function sendWelcomeEmail(
  to: string,
  data: WelcomeEmailProps
): Promise<void> {
  const html = await renderWelcomeEmail(data);
  await sendEmail({
    to,
    subject: 'Welcome to Elkdonis Arts Collective',
    html,
  });
}

export async function sendNewsletterEmail(
  to: string,
  data: NewsletterEmailProps
): Promise<void> {
  const html = await renderNewsletterEmail(data);
  await sendEmail({
    to,
    subject: data.title ?? 'A Letter From The Collective',
    html,
    fromName: data.orgName ?? 'Elkdonis Arts Collective',
  });
}
