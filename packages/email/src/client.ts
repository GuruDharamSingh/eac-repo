import sgMail from '@sendgrid/mail';
import { getOrgEmailIdentity, type EmailKind } from './identity';
import { recordSend } from './ledger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /**
   * The organisation this mail is sent on behalf of. Given, the From name,
   * reply-to and unsubscribe group are resolved from that org's identity, and
   * the send is tagged so SendGrid's stats and webhook events can be
   * attributed back to it. Optional only so that the call sites that predate
   * it keep working; every new call should pass it.
   */
  orgId?: string;
  /** What this mail *is*, for per-kind analytics and Feedback-ID. */
  kind?: EmailKind;
  /** Correlates a delivery event back to the thread that caused it. */
  threadId?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  /** Extra SendGrid categories beyond the org/kind pair added automatically. */
  categories?: string[];
  /** Extra webhook metadata. Values must be strings — SendGrid rejects others. */
  customArgs?: Record<string, string>;
  /** ASM unsubscribe group. Set for bulk mail; omit for transactional. */
  asmGroupId?: number;
  /** Validate the request against SendGrid without delivering it. */
  sandbox?: boolean;
  /**
   * Keep this send out of the ledger.
   *
   * For the doctor script and anything else that puts a synthetic message
   * through SendGrid to prove the wiring works — those are not letters the org
   * sent and an activity feed that shows them is lying about what happened.
   */
  noLedger?: boolean;
}

export interface SendEmailResult {
  /** SendGrid accepted the message (202), or validated it in sandbox (200). */
  ok: boolean;
  /** `x-message-id`, the key that ties this send to its webhook events. */
  messageId: string | null;
  /** True when nothing was delivered because sandbox mode was on. */
  sandboxed: boolean;
  /** True when the send was skipped outside production for want of a key. */
  skipped: boolean;
}

/** SendGrid's own ceiling. Two are used automatically, leaving eight. */
const MAX_CATEGORIES = 10;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;

  // Why this throws rather than warning: for months this package returned
  // quietly when the key was missing, every call site was fire-and-forget, and
  // so every RSVP confirmation and owner notification on the network was lost
  // into a console.warn nobody read. In production an unsendable email is a
  // failure and must be raised as one. Outside production it is just a
  // developer without a key, and blocking them helps no one.
  if (!apiKey) {
    if (isProduction()) {
      throw new Error('[email] SENDGRID_API_KEY is not set — refusing to drop mail silently');
    }
    console.warn('[email] SENDGRID_API_KEY not set — skipping (non-production)');
    return { ok: false, messageId: null, sandboxed: false, skipped: true };
  }

  sgMail.setApiKey(apiKey);

  const identity = opts.orgId ? await getOrgEmailIdentity(opts.orgId) : null;

  const fromEmail =
    opts.fromEmail ??
    identity?.fromEmail ??
    process.env.EMAIL_FROM ??
    'info@em6860.elkdonis-arts.org';
  const fromName =
    opts.fromName ??
    identity?.fromName ??
    process.env.EMAIL_FROM_NAME ??
    'Elkdonis Arts Collective';
  const replyTo = opts.replyTo ?? identity?.replyTo;
  const asmGroupId = opts.asmGroupId ?? identity?.asmGroupId;

  // Tagging every send with its org is what makes a shared SendGrid account
  // legible: without it the dashboard is one undifferentiated bar chart and a
  // webhook event cannot be traced to the organisation that sent it.
  const categories = [
    ...(opts.orgId ? [`org:${opts.orgId}`] : []),
    ...(opts.kind ? [`kind:${opts.kind}`] : []),
    ...(opts.categories ?? []),
  ].slice(0, MAX_CATEGORIES);

  const customArgs: Record<string, string> = {
    ...(opts.orgId ? { orgId: opts.orgId } : {}),
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.threadId ? { threadId: opts.threadId } : {}),
    ...(opts.customArgs ?? {}),
  };

  const sandbox = opts.sandbox ?? process.env.EMAIL_SANDBOX === '1';

  // A send with no org cannot be filed under one, and the ledger is org-scoped
  // by its foreign key. Those are the pre-identity call sites; they still send.
  const ledgerable = Boolean(opts.orgId) && !opts.noLedger;

  try {
    const [response] = await sgMail.send({
      to: opts.to,
      from: { email: fromEmail, name: fromName },
      subject: opts.subject,
      html: opts.html,
      ...(replyTo ? { replyTo } : {}),
      ...(categories.length ? { categories } : {}),
      ...(Object.keys(customArgs).length ? { customArgs } : {}),
      ...(asmGroupId ? { asm: { groupId: asmGroupId } } : {}),
      ...(sandbox ? { mailSettings: { sandboxMode: { enable: true } } } : {}),
      // Google Postmaster Tools aggregates spam complaints by this header, so
      // a spike can be traced to one org and one kind of mail rather than to
      // "the network". Costs nothing and cannot be added retroactively.
      ...(opts.orgId
        ? { headers: { 'Feedback-ID': `${opts.kind ?? 'mail'}:${opts.orgId}:eac` } }
        : {}),
    });

    const status = response?.statusCode ?? 0;
    const messageId =
      (response?.headers?.['x-message-id'] as string | undefined) ?? null;

    if (ledgerable) {
      // Awaited, not fire-and-forget: this whole package exists because a
      // previous generation of fire-and-forget email code lost months of mail
      // into a console nobody read. recordSend never throws (see ledger.ts), so
      // awaiting it cannot turn a delivered letter into a failed request.
      await recordSend({
        orgId: opts.orgId!,
        kind: opts.kind ?? 'notification',
        threadId: opts.threadId ?? null,
        toEmail: opts.to,
        subject: opts.subject,
        sgMessageId: messageId,
        status: sandbox ? 'sandboxed' : 'queued',
      });
    }

    return {
      // 202 Accepted for a real send, 200 OK for a sandbox validation.
      ok: status === 202 || status === 200,
      messageId,
      sandboxed: sandbox,
      skipped: false,
    };
  } catch (err) {
    // Re-thrown, not swallowed. Call sites decide whether a failed email should
    // fail the request; this layer's job is to tell the truth about it.
    console.error(`[email] send to ${opts.to} failed:`, err);

    // The failure is the fact worth keeping. Recorded BEFORE the re-throw, so
    // a call site that swallows the error still leaves a trace an org owner can
    // find when they ask why somebody never got their confirmation.
    if (ledgerable) {
      await recordSend({
        orgId: opts.orgId!,
        kind: opts.kind ?? 'notification',
        threadId: opts.threadId ?? null,
        toEmail: opts.to,
        subject: opts.subject,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}
