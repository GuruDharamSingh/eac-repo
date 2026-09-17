/**
 * The contract between an external agent and this stack.
 *
 * Deliberately narrow. Everything an agent can express lives in this file, so
 * "what can OpenClaw do to us" is answerable by reading one type rather than
 * auditing a service surface. Widening it is a deliberate act.
 */

/** Where the request originally came from, for attribution and revocation. */
export interface AgentSource {
  /** 'email' today; 'whatsapp' / 'sms' once a phone number can be verified. */
  channel: string;
  /**
   * The channel's own identifier for the message — an IMAP UID, a message id.
   * Carried through to the audit row so a published draft can be traced back
   * to the mail that asked for it.
   */
  reference?: string;
  /**
   * How the courier established who asked. 'dmarc' is the only value that
   * currently means anything cryptographic; anything else is an assertion.
   */
  verification?: string;
}

/** One piece of media to upload and attach to the draft. */
export interface AgentMedia {
  filename: string;
  mimeType: string;
  /** base64. Size is capped by the handler, not by the type. */
  content: string;
  caption?: string;
  altText?: string;
}

export interface AgentPostRequest {
  /** organizations.id — which org this is being written for. */
  orgId: string;
  title: string;
  /** HTML or plain text; plain text is converted on the way in. */
  body: string;
  /** Becomes the excerpt. Derived from the body when the agent omits it. */
  summary?: string;
  /** org_feeds.slug — which section of the org's site. Validated, not trusted. */
  section?: string;
  media?: AgentMedia[];
  /**
   * Stable per logical request. IMAP redelivers, agents retry; without this a
   * retried mail becomes a second draft. Same key returns the first result.
   */
  idempotencyKey?: string;
  source?: AgentSource;
}

export type AgentErrorCode =
  | 'unknown_sender'
  | 'unknown_org'
  | 'not_a_member'
  | 'insufficient_role'
  | 'unknown_section'
  | 'invalid_request'
  | 'media_rejected'
  | 'internal_error';

export interface AgentPostMedia {
  id: string;
  url: string;
  filename: string;
}

export type AgentPostResult =
  | {
      ok: true;
      threadId: string;
      slug: string;
      /** Always 'draft'. The bridge cannot publish — see postForAgent. */
      status: 'draft';
      orgId: string;
      media: AgentPostMedia[];
      /** True when an earlier identical request already created this draft. */
      replayed: boolean;
    }
  | { ok: false; code: AgentErrorCode; error: string };

/**
 * A caller whose identity has already been established by the app mounting the
 * handler — never by anything in this package, and never by the agent.
 */
export interface AgentIdentity {
  /** users.id of the human who asked. */
  userId: string;
  email: string;
  /** The OIDC client that carried the request, e.g. 'openclaw'. */
  clientId: string;
}
