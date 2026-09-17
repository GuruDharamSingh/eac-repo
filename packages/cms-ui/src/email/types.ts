// ============================================================================
// The email suite's vocabulary.
//
// Declared here rather than imported from @elkdonis/email, for the same reason
// hub/types.ts re-declares the hub shapes: this package stays free of the data
// layer so it can be dropped into any host. Every shape below is STRUCTURAL,
// so a host passes the @elkdonis/email objects straight in with no adapter.
// ============================================================================

export type EmailDirection = "sent" | "received";

/** One line in the activity feed. Structurally the services `ActivityRow`. */
export interface EmailActivity {
  id: string;
  direction: EmailDirection;
  /** The letter's kind for a send; the classification for an arrival. */
  kind: string;
  /** Who it went to, or who it came from. Already collapsed for a bulk send. */
  who: string;
  subject: string | null;
  /** 'sent' / '3 failed' / 'unread' — one word for a list, not a status enum. */
  status: string;
  /** ISO. */
  at: string;
}

/** One arrival. Structurally the `InboxMessage` of @elkdonis/email. */
export interface EmailMessage {
  id: string;
  threadId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  classification: "reply" | "enquiry" | "auto" | "bounce" | "spam";
  state: "unread" | "read" | "archived";
  attachments: Array<{ name: string; type?: string; size?: number; url?: string }>;
  receivedAt: string;
}

/** One entry in the address book. Structurally the `AddressEntry`. */
export interface EmailAddress {
  id: string;
  email: string;
  name: string | null;
  sources: Array<"contact" | "manual" | "member" | "guest">;
  status: "new" | "contacted" | "joined" | "unsubscribed";
  role: string | null;
  tags: string[];
  notes: string | null;
  mailable: boolean;
  addedAt: string | null;
}

/** One of the org's letters, as the suite lists it. */
export interface EmailTemplateSummary {
  key: string;
  title: string;
  /** What causes it to be sent, in a sentence. */
  trigger: string;
  /** Who receives it. */
  recipient: string;
  /** Whether an org may override this one at all. */
  editable: boolean;
  /** Where the org's own words land in this letter, in a sentence. */
  editHint?: string;
  /** The org's own words today, so the editor opens on them. */
  bodyText?: string | null;
  /**
   * Which layer is winning for this org right now.
   *   default — the network's words
   *   words   — the org typed its own body
   *   layout  — the org laid the whole thing out in the editor
   */
  override: "default" | "words" | "layout";
}

/** How the org's mail is addressed and coloured. */
export interface EmailIdentitySummary {
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  ownerEmails: string[];
  /** False when the From fell back to the network's authenticated domain. */
  fromIsOrgDomain: boolean;
  palette?: { accent?: string; onAccent?: string; ink?: string };
  /** Whether replies land in this inbox. */
  inboundReplies: boolean;
  /** The address replies would arrive at. Null when inbound isn't configured. */
  inboundAddress: string | null;
}

export interface EmailDeliveryStats {
  sent: number;
  delivered: number;
  bounced: number;
  unsubscribed: number;
  pending: number;
}

/**
 * Everything the suite draws, loaded once by the host.
 *
 * One object rather than five connector calls on open, because every tab of
 * the suite is a view of the same org and splitting it would mean five
 * round-trips to draw one panel.
 */
export interface EmailSuiteData {
  orgId: string;
  orgName: string;
  identity: EmailIdentitySummary;
  activity: EmailActivity[];
  inbox: EmailMessage[];
  unread: number;
  addresses: EmailAddress[];
  templates: EmailTemplateSummary[];
  stats: EmailDeliveryStats;
  /** Where the full-page suite lives. The card's "Go to the email suite". */
  suiteHref: string;
  /** Where the GrapesJS newsletter editor lives. Omit and the tab says so. */
  newsletterHref?: string;
  /** Per-letter editor routes. `{key}` is substituted. */
  templateHref?: string;
  templateLayoutHref?: string;
}

/**
 * What the suite needs the host to DO. Every one is optional: a host that
 * supplies none gets a readable suite with no controls, which is the right
 * degradation for a member rather than an owner.
 */
export interface EmailConnectors {
  /** Reload after a change. Supplied so the host can re-render its own page. */
  refresh?: () => void | Promise<void>;

  /** Mark read / archived. */
  setMessageState?: (
    id: string,
    state: "unread" | "read" | "archived"
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Rescue from spam, or send to it. */
  reclassify?: (
    id: string,
    classification: EmailMessage["classification"]
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Paste or type addresses in. Returns what happened to each. */
  addAddresses?: (input: { text: string; tags?: string[] }) => Promise<{
    ok: boolean;
    added?: number;
    updated?: number;
    skippedUnsubscribed?: number;
    rejected?: string[];
    error?: string;
  }>;

  /** Edit one entry's name, tags or notes. */
  updateAddress?: (input: {
    id: string;
    name?: string | null;
    tags?: string[];
    notes?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;

  /** Stop mailing somebody who asked off-channel. */
  suppressAddress?: (email: string) => Promise<{ ok: boolean; error?: string }>;

  /** Take a manually-added entry off the list. */
  removeAddress?: (id: string) => Promise<{ ok: boolean; error?: string }>;

  /** Save the org's colours and reply routing. Partial — see saveOrgEmailIdentity. */
  saveIdentity?: (input: {
    fromName?: string | null;
    replyTo?: string | null;
    ownerEmails?: string[];
    palette?: { accent?: string; onAccent?: string; ink?: string };
    inboundReplies?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;

  /** Render one letter as HTML, for the preview pane. */
  previewTemplate?: (key: string) => Promise<{ html: string } | { error: string }>;

  /**
   * Save an org's own words for one letter. Omit and the Letters tab reads
   * only.
   *
   * This is in the SUITE rather than on a per-host page, and that is the point:
   * "write your own words" was a route (`/hub/email/<key>`) that existed in the
   * single-tenant apps and nowhere else, so the network hub — which has to
   * carry an `?org=` through every URL — simply had no such page and shipped
   * three dead links. A connector has no route in it, so one editor now works
   * on any host, single-tenant or org-switching.
   *
   * An empty string means "go back to the network's words", not "send a blank
   * section".
   */
  saveTemplate?: (
    key: string,
    bodyText: string
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Send one letter to the signed-in editor, to see it in a real inbox. */
  testTemplate?: (key: string) => Promise<{ ok: boolean; error?: string }>;
}
