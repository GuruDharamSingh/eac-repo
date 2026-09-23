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

/**
 * One editable block of one letter.
 *
 * The suite used to offer exactly one box per letter — "your own words", which
 * APPENDED a section. Everything the letter already said was the network's and
 * could only be changed by abandoning the letter for the layout editor. These
 * are those sentences: the confirmation line, the button, the headings, the
 * description of the network. An org may rewrite any of them.
 *
 * Declared structurally, like everything else here, so the host passes the
 * `@elkdonis/email` slot registry straight in with no adapter.
 */
export interface EmailCopySlot {
  id: string;
  /** What the editor calls this block. */
  label: string;
  /** Where it appears in the letter, in a sentence. */
  hint: string;
  /** `prose` gets a rich-text box; `line` gets a single input. */
  kind: "prose" | "line";
  /** The network's words — shown when the org has written none. */
  fallback: string;
  /** The org's words. */
  text?: string | null;
  /** The org's words with formatting, for a `prose` block. */
  html?: string | null;
  /** The `{tokens}` this block may use. */
  tokens?: string[];
}

/** One value a letter fills in per recipient. What goes where. */
export interface EmailMergeField {
  name: string;
  label: string;
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
   * The same words as rich text, when they were written in the editor rather
   * than typed as plain paragraphs. The editor opens on THIS when it exists —
   * opening on `bodyText` instead would silently discard every link and every
   * emphasis the moment somebody re-saved.
   */
  bodyHtml?: string | null;
  /**
   * Every block of copy in this letter, in reading order.
   *
   * Empty for a letter with no editable prose of its own — the editor then
   * shows only the appended-words box, which is what every letter had before.
   */
  slots?: EmailCopySlot[];
  /** What this letter fills in per recipient, for the token palette. */
  mergeFields?: EmailMergeField[];
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
  palette?: {
    accent?: string;
    onAccent?: string;
    ink?: string;
    /** Which body face this org's mail is set in, by id. */
    bodyFont?: string;
    /**
     * The org's own masthead image, shown at the top of every letter instead
     * of the collective's wordmark. An absolute https URL.
     */
    bannerUrl?: string;
    /** Alt text for it, for the inboxes that block images. */
    bannerAlt?: string;
    /** The rule around the card, and its thickness in px (1–4). */
    frameColor?: string;
    frameWidth?: number;
  };
  /** The faces an org may choose between, from the sending package. */
  fonts?: Array<{ id: string; label: string; hint: string }>;
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

  /**
   * Reply to a message from the ORG's address, in place.
   *
   * Optional, and the Inbox falls back to a `mailto:` link when a host does
   * not supply it — so a site that has not wired the route keeps exactly the
   * behaviour it had. `to` is deliberately NOT a parameter: the host resolves
   * the recipient from the stored message, because a client-supplied address
   * would make this an open relay signed as the organisation.
   */
  sendReply?: (input: {
    messageId: string;
    subject: string;
    body: string;
  }) => Promise<{ ok: boolean; error?: string }>;

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
    palette?: {
      accent?: string;
      onAccent?: string;
      ink?: string;
      bodyFont?: string;
      bannerUrl?: string;
      bannerAlt?: string;
      frameColor?: string;
      frameWidth?: number;
    };
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
    bodyText: string,
    /**
     * The rich version, when the host has a rich editor to produce one.
     *
     * A THIRD positional argument rather than an options object, because two
     * hosts already implement this connector and neither should have to change
     * to keep working. `bodyText` stays required and stays first: it is the
     * plain-text rendering of the same words, derived rather than typed, and
     * it is what the templates fall back to and what a text/plain part carries.
     */
    bodyHtml?: string
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Send one letter to the signed-in editor, to see it in a real inbox. */
  testTemplate?: (key: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Rewrite ONE block of one letter. Omit and the copy columns read only.
   *
   * Separate from `saveTemplate` rather than folded into it, because they are
   * different objects: `saveTemplate` writes the section an org APPENDS to a
   * letter, this rewrites a sentence the letter already had. Saving one must
   * never disturb the other, and a connector that took both would make that a
   * convention rather than a guarantee.
   *
   * An empty `text` means "go back to the network's words" for that block.
   */
  saveCopy?: (
    key: string,
    slotId: string,
    text: string,
    html?: string
  ) => Promise<{ ok: boolean; error?: string }>;
}
