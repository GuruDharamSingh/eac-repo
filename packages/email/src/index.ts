import { sendEmail, type SendEmailResult } from './client';
import {
  getOrgEmailIdentity,
  saveOrgEmailIdentity,
  clearEmailIdentityCache,
  emailChromeFor,
  EMAIL_IDENTITY_KEY,
  type OrgEmailIdentity,
  type EmailPalette,
  type EmailKind,
} from './identity';
import { renderRsvpGuestEmail, type RsvpGuestEmailProps } from './templates/rsvp-guest';
import { renderRsvpOwnerEmail, type EmailLinkItem, type EmailMediaItem, type RsvpOwnerEmailProps } from './templates/rsvp-owner';
import { renderContactOwnerEmail, type ContactOwnerEmailProps } from './templates/contact-owner';
import { renderOrderInvoiceEmail, type OrderInvoiceEmailProps } from './templates/order-invoice';
import { renderOrderNotificationEmail, type OrderNotificationEmailProps } from './templates/order-notification';
import { renderWelcomeEmail, type WelcomeEmailProps, type WelcomeLinkItem, type WelcomeMediaItem } from './templates/welcome';
import { renderNewsletterEmail, type NewsletterEmailProps, type NewsletterLinkItem, type NewsletterMediaItem } from './templates/newsletter';
import { renderReminderEmail, type ReminderEmailProps } from './templates/reminder';
import { renderMeetingTriggerEmail, type MeetingTriggerEmailProps, type MeetingTriggerType } from './templates/meeting-trigger';
import { renderProvisioningEmail, type ProvisioningEmailProps } from './templates/provisioning';
import { renderOwnerNotificationEmail, type OwnerNotificationEmailProps, type OwnerNotificationKind } from './templates/rsvp-owner';
import { ProfileCard, ThreadCard, Prose, type ProfileCardProps, type ThreadCardProps } from './components/cards';
import * as copy from './copy';
import {
  COPY_SLOTS,
  TEMPLATE_SLOTS,
  copySlotsFor,
  slotText,
  slotLine,
  parseCopyOverrides,
  type CopyOverrides,
  type CopySlot,
} from './copy-slots';
import {
  EMAIL_FONTS,
  DEFAULT_EMAIL_FONT,
  emailFontStack,
  type EmailFontId,
} from './components/EmailShell';
import { renderSample, renderWithProps, sampleProps, templateMeta, TEMPLATE_META, type TemplateMeta, type SampleOptions } from './samples';
import {
  renderTemplateBody,
  renderTemplateEnvelope,
  extractEditableBody,
  type TemplateEnvelope,
} from './seed';
import {
  MERGE_FIELDS,
  mergeFieldsFor,
  sampleValuesFor,
  tokenValuesFor,
  fillHtml,
  type MergeField,
} from './merge-fields';
import { renderAdvancedEmail, bodyOf, type AdvancedEmailProps } from './templates/advanced';
import { mergeValuesFor } from './merge-fields';
import {
  inboundHost,
  inboundEnabled,
  inboundAddressFor,
  inboundAddressForThread,
  parseInboundRecipient,
  classifyInbound,
  addressOf,
  displayNameOf,
  recordInbound,
  listInbox,
  unreadCount,
  getInboxMessage,
  setInboxState,
  reclassifyInbox,
  type InboxMessage,
  type InboxState,
  type InboundClassification,
  type ListInboxOptions,
  type ParsedInboundRecipient,
  type RecordInboundInput,
} from './inbox';
import {
  listAddressBook,
  listMailable,
  parseAddressList,
  addAddresses,
  updateContact,
  suppressAddress,
  removeContact,
  type AddressEntry,
  type AddressSource,
  type AddAddressesResult,
  type ParsedAddress,
} from './address-book';
import {
  recordSend,
  ingestEvents,
  recentActivity,
  deliveryStats,
  type SendStatus,
  type SendRecord,
  type SendGridEvent,
  type IngestResult,
  type ActivityRow,
  type DeliveryStats,
} from './ledger';
import {
  loadOrgTemplate,
  listOrgTemplates,
  saveOrgTemplate,
  clearOrgTemplate,
  resolveOrgTemplate,
  threadTemplateKey,
  isTemplateKey,
  TEMPLATE_KEYS,
  type TemplateKey,
  type OrgTemplate,
} from './template-store';

export type { CopyOverrides, CopySlot } from './copy-slots';
export type { EmailFontId, EmailFont, EmailChrome } from './components/EmailShell';

export type {
  SendEmailResult,
  OrgEmailIdentity,
  EmailPalette,
  EmailKind,
  InboxMessage,
  InboxState,
  InboundClassification,
  ListInboxOptions,
  ParsedInboundRecipient,
  RecordInboundInput,
  AddressEntry,
  AddressSource,
  AddAddressesResult,
  ParsedAddress,
  SendStatus,
  SendRecord,
  SendGridEvent,
  IngestResult,
  ActivityRow,
  DeliveryStats,
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
  ProvisioningEmailProps,
  OwnerNotificationEmailProps,
  OwnerNotificationKind,
  ProfileCardProps,
  ThreadCardProps,
  AdvancedEmailProps,
  TemplateKey,
  OrgTemplate,
  TemplateMeta,
  SampleOptions,
};

export {
  // ── Mail that comes back (migration 134) ─────────────────────────────────
  inboundHost,
  inboundEnabled,
  inboundAddressFor,
  inboundAddressForThread,
  parseInboundRecipient,
  classifyInbound,
  addressOf,
  displayNameOf,
  recordInbound,
  listInbox,
  unreadCount,
  getInboxMessage,
  setInboxState,
  reclassifyInbox,

  // ── The address book: contacts + members + guests, merged ────────────────
  listAddressBook,
  listMailable,
  parseAddressList,
  addAddresses,
  updateContact,
  suppressAddress,
  removeContact,

  // ── The delivery ledger (migration 135) ──────────────────────────────────
  recordSend,
  ingestEvents,
  recentActivity,
  deliveryStats,

  sendEmail,
  getOrgEmailIdentity,
  saveOrgEmailIdentity,
  clearEmailIdentityCache,
  EMAIL_IDENTITY_KEY,
  renderRsvpGuestEmail,
  renderRsvpOwnerEmail,
  renderContactOwnerEmail,
  renderOrderInvoiceEmail,
  renderOrderNotificationEmail,
  renderWelcomeEmail,
  renderNewsletterEmail,
  renderReminderEmail,
  renderMeetingTriggerEmail,
  renderProvisioningEmail,
  renderOwnerNotificationEmail,
  // The building blocks, so an app can preview or compose with the same shapes
  // the templates use rather than redrawing them.
  ProfileCard,
  ThreadCard,
  Prose,
  // The network's default words, as data. Editing copy happens here.
  copy,
  // Every block of every letter, addressable — what the Letters editor lists
  // and what an org may rewrite one at a time.
  COPY_SLOTS,
  TEMPLATE_SLOTS,
  copySlotsFor,
  slotText,
  slotLine,
  parseCopyOverrides,
  // The body faces an org may choose between.
  EMAIL_FONTS,
  DEFAULT_EMAIL_FONT,
  emailFontStack,
  // An org's own layout, wrapped in the network's envelope.
  renderAdvancedEmail,
  bodyOf,
  // Where an org's version of a template lives.
  loadOrgTemplate,
  listOrgTemplates,
  saveOrgTemplate,
  clearOrgTemplate,
  resolveOrgTemplate,
  threadTemplateKey,
  isTemplateKey,
  TEMPLATE_KEYS,
  // One sample of each letter, shared by every surface that shows the suite.
  renderSample,
  renderWithProps,
  sampleProps,
  renderTemplateBody,
  renderTemplateEnvelope,
  extractEditableBody,
  MERGE_FIELDS,
  mergeFieldsFor,
  mergeValuesFor,
  sampleValuesFor,
  tokenValuesFor,
  fillHtml,
  templateMeta,
  TEMPLATE_META,
  // One org's stored look → the chrome every letter wears.
  emailChromeFor,
};

// ----------------------------------------------------------------------------
// Three layers, resolved once, here.
//
// Every send helper below runs its props through this, so an organisation's
// override applies wherever that email is sent from — rather than each app
// remembering to look one up, which is how amrit-canada and inner-gathering
// ended up with two different per-thread settings schemes.
// ----------------------------------------------------------------------------

interface OverridableProps {
  orgId?: string;
  threadId?: string;
  bodyText?: string;
  bodyHtml?: string;
  /** This org's words for the letter's own blocks. See copy-slots.ts. */
  copy?: CopyOverrides;
  links?: { label: string; url: string }[];
  media?: { url: string; alt?: string; caption?: string }[];
  /** Filled in from the org's identity — callers do not pass these. */
  orgName?: string;
  orgHeader?: boolean;
  orgAccent?: string;
  bodyFont?: string;
}

async function renderWithOverrides<P extends OverridableProps>(
  key: TemplateKey,
  data: P,
  fallback: (data: P) => Promise<string>,
  shell: Omit<AdvancedEmailProps, 'html'>
): Promise<string> {
  if (!data.orgId) return fallback(data);

  const [identity, template] = await Promise.all([
    getOrgEmailIdentity(data.orgId).catch(() => null),
    resolveOrgTemplate(data.orgId, key, data.threadId).catch(() => null),
  ]);

  // Whose name goes at the top. An org leads the header only once it actually
  // sends from its own authenticated domain — a header saying "IFAC" above a
  // From of info@em6860.elkdonis-arts.org is the mismatch a spam filter reads
  // as impersonation, and a reader would be right to distrust it too. So this
  // switches over on its own the day the DNS lands, with no second decision.
  const branding = identity
    ? {
        orgName: data.orgName ?? identity.fromName,
        orgHeader: identity.fromIsOrgDomain,
        orgAccent: identity.accentColor,
        // The masthead image and the frame. Like the face below and unlike
        // the header NAME above, these are not gated on the authenticated
        // domain: a picture and a rule make no claim a spam filter reads.
        chrome: emailChromeFor(identity),
        // Unlike the header colour, the face applies whether or not the org
        // sends from its own domain: it is how the letter READS, not a claim
        // about who sent it, so there is nothing for a spam filter to
        // disagree with.
        bodyFont: identity.palette?.bodyFont,
      }
    : {};

  // Layer 3 — the org laid this out itself. Its HTML replaces the body; the
  // shell, and whatever the footer carries, stays the network's.
  if (template?.html) {
    // The layout is static HTML, so anything per-recipient in it is a `{field}`
    // token. Substituting here is what makes a laid-out confirmation say the
    // guest's own name — before this, whatever was on the editor's canvas went
    // to everybody verbatim.
    return renderAdvancedEmail({
      ...shell,
      ...branding,
      html: template.html,
      values: mergeValuesFor(key, { ...data, ...branding } as Record<string, unknown>),
    });
  }

  // Layer 2 — the org's words, but only where the caller has not already
  // passed something more specific (a per-send message beats a stored one).
  return fallback({
    ...data,
    ...branding,
    bodyText: data.bodyText ?? template?.bodyText,
    // Taken together with bodyText, not instead of it: a caller that passes a
    // per-send plain message must not have the org's STORED rich version
    // rendered over the top of it, so the rich layer only applies when the
    // plain one came from the same place.
    bodyHtml: data.bodyHtml ?? (data.bodyText ? undefined : template?.bodyHtml),
    // NOT `??`: a caller passing one block's words must not silently discard
    // every other block this org has rewritten. The caller's slots win
    // individually, the stored ones fill the rest.
    copy: { ...(template?.copy ?? {}), ...(data.copy ?? {}) },
    links: data.links ?? template?.links,
    media: data.media ?? template?.media,
  });
}


// ----------------------------------------------------------------------------
// The high-level helpers.
//
// Each takes an optional `orgId` alongside its template props. Passing it is
// what turns a send from "mail from the network" into "mail from this
// organisation": the From name, reply-to and unsubscribe group are resolved
// from that org's identity, and the message is tagged `org:<id>` / `kind:<k>`
// so SendGrid's stats and webhook events can be attributed. It is optional
// only for backwards compatibility — pass it.
// ----------------------------------------------------------------------------

/** Props every helper accepts on top of its template's own. */
export interface OrgSendContext {
  orgId?: string;
  threadId?: string;
}

export async function sendReminderEmail(
  to: string,
  data: ReminderEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderWithOverrides('reminder', data, renderReminderEmail, {
    previewText: `${data.meetingTitle} — starting soon`,
    kicker: 'A reminder',
  });
  return sendEmail({
    to,
    subject: `Starting soon — ${data.meetingTitle}`,
    html,
    orgId: data.orgId,
    kind: 'reminder',
    threadId: data.threadId,
    ...(data.orgId ? {} : { fromName: data.orgName }),
  });
}

export async function sendMeetingTriggerEmail(
  to: string,
  data: MeetingTriggerEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderMeetingTriggerEmail(data);
  const subject = data.type === 'cancellation'
    ? `Cancelled — ${data.meetingTitle}`
    : data.type === 'confirmation'
      ? `Confirmed — ${data.meetingTitle}`
      : `Reminder — ${data.meetingTitle}`;
  return sendEmail({
    to,
    subject,
    html,
    orgId: data.orgId,
    kind: 'reminder',
    threadId: data.threadId,
  });
}

export async function sendRsvpConfirmation(
  to: string,
  data: RsvpGuestEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderWithOverrides('rsvp-guest', data, renderRsvpGuestEmail, {
    previewText: `Your place at ${data.meetingTitle} is confirmed`,
    kicker: 'You are on the list',
  });
  return sendEmail({
    to,
    subject: `RSVP Confirmed — ${data.meetingTitle}`,
    html,
    orgId: data.orgId,
    kind: 'rsvp',
    threadId: data.threadId,
    ...(data.orgId ? {} : { fromName: data.orgName }),
  });
}

export async function sendRsvpNotification(
  to: string,
  data: RsvpOwnerEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderWithOverrides('rsvp-owner', data, renderRsvpOwnerEmail, {
    previewText: `${data.guestName} — ${data.meetingTitle}`,
    kicker: data.variant === 'reconfirmed' ? 'Confirmed' : 'New RSVP',
  });
  const subjectPrefix = data.variant === 'reconfirmed' ? 'Confirmed' : 'New RSVP';
  return sendEmail({
    to,
    subject: `${subjectPrefix}: ${data.guestName} — ${data.meetingTitle}`,
    html,
    orgId: data.orgId,
    kind: 'notification',
    threadId: data.threadId,
    // The guest's own address, so the owner can just hit reply. This beats the
    // org identity's reply-to on purpose.
    ...(data.guestEmail ? { replyTo: data.guestEmail } : {}),
  });
}

export async function sendContactNotification(
  to: string,
  data: ContactOwnerEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderContactOwnerEmail(data);
  return sendEmail({
    to,
    subject: `Contact form: ${data.senderName} — ${data.orgName ?? 'Elkdonis Arts Collective'}`,
    html,
    orgId: data.orgId,
    kind: 'contact',
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
    kind: 'order',
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
    kind: 'order',
    fromName: 'Art-Auction',
    replyTo: data.customerEmail,
  });
}

export async function sendWelcomeEmail(
  to: string,
  data: WelcomeEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  // The subject used to name the collective regardless of which organisation
  // the person had actually joined.
  const orgName = data.orgId ? (await getOrgEmailIdentity(data.orgId)).fromName : null;
  const html = await renderWithOverrides(
    'welcome',
    { ...data, orgName: data.orgName ?? orgName ?? undefined },
    renderWelcomeEmail,
    {
      previewText: `Your account with ${orgName ?? 'the Elkdonis Arts Collective'}`,
      kicker: orgName ? `Welcome to ${orgName}` : 'Welcome to the Collective',
    }
  );
  return sendEmail({
    to,
    subject: `Welcome to ${orgName ?? 'Elkdonis Arts Collective'}`,
    html,
    orgId: data.orgId,
    kind: 'welcome',
  });
}

export async function sendNewsletterEmail(
  to: string,
  data: NewsletterEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderNewsletterEmail(data);
  return sendEmail({
    to,
    subject: data.title ?? 'A Letter From The Collective',
    html,
    orgId: data.orgId,
    kind: 'newsletter',
    ...(data.orgId ? {} : { fromName: data.orgName ?? 'Elkdonis Arts Collective' }),
  });
}


/**
 * "Your cloud account is ready to claim."
 *
 * Sent after the address is confirmed and provisioning has run — not with the
 * welcome, which goes out before the Nextcloud account exists.
 */
export async function sendProvisioningEmail(
  to: string,
  data: ProvisioningEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderWithOverrides('provisioning', data, renderProvisioningEmail, {
    previewText: 'Claim your Nextcloud account and cloud storage',
    kicker: 'Your cloud account is ready',
  });
  return sendEmail({
    to,
    subject: data.orgName
      ? `Claim your cloud account — ${data.orgName}`
      : 'Claim your cloud account',
    html,
    orgId: data.orgId,
    kind: 'welcome',
  });
}

/**
 * "Someone just arrived." — one send for every kind of arrival.
 *
 * `sendRsvpNotification` remains as the RSVP-shaped name every existing caller
 * uses; this is the same template with the kind made explicit.
 */
export async function sendOwnerNotification(
  to: string,
  data: OwnerNotificationEmailProps & OrgSendContext
): Promise<SendEmailResult> {
  const html = await renderWithOverrides('rsvp-owner', data, renderOwnerNotificationEmail, {
    previewText: `${data.guestName} — ${data.meetingTitle}`,
    kicker: 'Someone arrived',
  });
  const action =
    data.variant === 'reconfirmed'
      ? 'Confirmed'
      : data.notificationKind === 'signup'
        ? 'New signup'
        : data.notificationKind === 'follow'
          ? 'New follower'
          : data.notificationKind === 'purchase'
            ? 'New purchase'
            : data.notificationKind === 'contact'
              ? 'New message'
              : 'New RSVP';
  return sendEmail({
    to,
    subject: `${action}: ${data.guestName} — ${data.meetingTitle}`,
    html,
    orgId: data.orgId,
    kind: 'notification',
    threadId: data.threadId,
    ...(data.guestEmail ? { replyTo: data.guestEmail } : {}),
  });
}
