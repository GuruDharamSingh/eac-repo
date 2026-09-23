"use client";

import * as React from "react";
import { emailHtmlToText } from "@elkdonis/utils/html-to-text";
import { SurfaceFrame, SurfaceSection, type SurfaceDescriptor } from "../surface";
import { RichTextEditor } from "../editor";
import type {
  EmailConnectors,
  EmailCopySlot,
  EmailMessage,
  EmailSuiteData,
  EmailAddress,
} from "./types";

// ============================================================================
// The email suite, as one surface.
//
// Five tabs over one organisation's mail:
//
//   Activity     what has gone out and come back, both directions, one feed
//   Inbox        the replies and enquiries that arrived, and what to do
//   Addresses    everyone reachable — contacts, members and guests, merged
//   Letters      the nine templates, which layer is winning, where to edit
//   Look         the org's own colours, and where replies are routed
//
// It replaces four separate attempts: amrit-canada's per-thread EmailSurface,
// innergathering's /hub/email template gallery, hidden-enneagram's
// /manage/contacts, and the newsletter list beside it. Each was app-local and
// knew about one of the five things.
//
// SAME COMPONENT, TWO HOMES. This is rendered both inside the popup (as a
// host-registered `custom` surface) and as the body of the full-page suite.
// SurfaceFrame already adapts — SurfacePage renders it as a page — so the
// suite is not a second implementation of itself, which is precisely how the
// four attempts above drifted apart.
//
// Everything below is presentational: it takes data and connectors and touches
// no database and no route, like the rest of this package.
// ============================================================================

export type EmailTab = "activity" | "inbox" | "addresses" | "letters" | "look";

const TABS: Array<{ key: EmailTab; label: string }> = [
  { key: "activity", label: "Activity" },
  { key: "inbox", label: "Inbox" },
  { key: "addresses", label: "Addresses" },
  { key: "letters", label: "Letters" },
  { key: "look", label: "Look" },
];

export interface EmailSurfaceProps {
  data: EmailSuiteData;
  connectors?: EmailConnectors;
  /** Which tab opens first. */
  tab?: EmailTab;
  /** False for a member: the suite reads, nothing writes. */
  canEdit?: boolean;
  /** Rendered as a page rather than a popup — drops the frame's own chrome. */
  asPage?: boolean;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Inbound mail is written by strangers, so its body is NEVER injected.
 *
 * `body_html` is stored (it is the evidence of what was actually sent) and is
 * deliberately not rendered here: sanitising markup well enough to put it in a
 * logged-in session is a job for a hardened sanitiser at the host, not for a
 * popup component, and the plain-text part says the same thing. A message with
 * no text part at all says so rather than showing an empty panel.
 */
function readableBody(message: EmailMessage): string {
  if (message.bodyText?.trim()) return message.bodyText;
  if (message.bodyHtml) {
    // Not sanitisation — a crude de-tag so an HTML-only message is still
    // readable. It cannot execute anything because it lands in a text node.
    const stripped = message.bodyHtml
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped) return stripped;
  }
  return "(This message had no readable text.)";
}

export function EmailSurface({
  data,
  connectors,
  tab: initialTab = "activity",
  canEdit = true,
  asPage = false,
}: EmailSurfaceProps) {
  const [tab, setTab] = React.useState<EmailTab>(initialTab);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const say = (message: string) => {
    setError(null);
    setStatus(message);
  };

  /** Every write goes through here so one place owns busy/status/refresh. */
  async function run(
    label: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "That didn't work.");
        return false;
      }
      setStatus(label);
      await connectors?.refresh?.();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="eac-email">
      <nav className="eac-email-tabs" aria-label="Email">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`eac-email-tab${tab === t.key ? " is-current" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "inbox" && data.unread > 0 && (
              <span className="eac-email-tab-count">{data.unread}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "activity" && <ActivityTab data={data} />}
      {tab === "inbox" && (
        <InboxTab data={data} connectors={connectors} canEdit={canEdit} run={run} busy={busy} />
      )}
      {tab === "addresses" && (
        <AddressesTab data={data} connectors={connectors} canEdit={canEdit} run={run} busy={busy} say={say} />
      )}
      {tab === "letters" && (
        <LettersTab data={data} connectors={connectors} canEdit={canEdit} />
      )}
      {tab === "look" && (
        <LookTab data={data} connectors={connectors} canEdit={canEdit} run={run} busy={busy} />
      )}
    </div>
  );

  // As a PAGE, the frame is dropped entirely rather than merely stripped of
  // its buttons. SurfaceFrame always draws a masthead and a ✕ — correct in the
  // popup, wrong on a page that has its own <h1> and nothing to close. The
  // first render of this page showed "Email ✕" twice, once from the page
  // header and once from the frame.
  if (asPage) {
    return (
      <div className="eac-email-page">
        {body}
        {(error ?? status) && (
          <p
            className={`eac-email-status${error ? " is-error" : ""}`}
            role="status"
            aria-live="polite"
          >
            {error ?? status}
          </p>
        )}
      </div>
    );
  }

  return (
    <SurfaceFrame
      kind="neutral"
      title="Email"
      kicker={data.orgName}
      status={error ?? status}
      statusTone={error ? "error" : "normal"}
      actions={[{ label: "Go to the email suite", href: data.suiteHref, primary: true }]}
    >
      {body}
    </SurfaceFrame>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: EmailSuiteData }) {
  const { stats } = data;

  return (
    <>
      {/* Real numbers, from the delivery ledger rather than from attempts.
          `pending` is shown rather than folded into `delivered`: a send with
          no webhook event yet is genuinely unknown, and rounding that up to
          "delivered" is the exact lie this ledger was built to stop. */}
      <SurfaceSection title="Delivery">
        <dl className="eac-email-stats">
          <Stat label="Sent" value={stats.sent} />
          <Stat label="Delivered" value={stats.delivered} />
          <Stat label="Bounced" value={stats.bounced} tone={stats.bounced ? "bad" : undefined} />
          <Stat label="Unsubscribed" value={stats.unsubscribed} />
          <Stat label="Awaiting news" value={stats.pending} />
        </dl>
        {stats.sent === 0 && (
          <p className="eac-surface-muted">
            No letter has been sent from this organisation yet.
          </p>
        )}
      </SurfaceSection>

      <SurfaceSection title="Recently">
        {data.activity.length === 0 ? (
          <p className="eac-surface-empty">Nothing sent or received yet.</p>
        ) : (
          <ul className="eac-email-list">
            {data.activity.map((row) => (
              <li key={`${row.direction}-${row.id}`} className="eac-email-item">
                <span className={`eac-email-mark eac-email-mark--${row.direction}`} aria-hidden>
                  {row.direction === "sent" ? "↗" : "↙"}
                </span>
                <span className="eac-email-item-main">
                  <span className="eac-email-item-title">{row.subject || row.kind}</span>
                  <span className="eac-email-item-sub">
                    {row.direction === "sent" ? "To " : "From "}
                    {row.who} · {row.kind}
                  </span>
                </span>
                <span className="eac-email-item-side">
                  <span className="eac-email-item-when">{fmt(row.at)}</span>
                  <span className="eac-email-item-status">{row.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SurfaceSection>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className={`eac-email-stat${tone === "bad" ? " is-bad" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// ── Inbox ───────────────────────────────────────────────────────────────────

function InboxTab({
  data,
  connectors,
  canEdit,
  run,
  busy,
}: {
  data: EmailSuiteData;
  connectors?: EmailConnectors;
  canEdit: boolean;
  run: (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
  busy: boolean;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  // The reply composer, open per message. Keyed by id so backing out of a
  // message and into another does not carry a half-written reply across.
  const [replyFor, setReplyFor] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [replySubject, setReplySubject] = React.useState("");

  if (!data.identity.inboundAddress) {
    return (
      <SurfaceSection title="Nothing arrives here yet">
        <p className="eac-surface-muted">
          This network can receive mail, but no inbound address is configured for
          this site yet. Once it is, replies to {data.identity.fromName}&rsquo;s
          letters land here instead of in someone&rsquo;s personal inbox.
        </p>
      </SurfaceSection>
    );
  }

  const open = data.inbox.find((m) => m.id === openId) ?? null;

  if (open) {
    return (
      <SurfaceSection title={open.subject || "(no subject)"}>
        <button
          type="button"
          className="eac-email-quietbtn eac-email-back"
          onClick={() => setOpenId(null)}
        >
          ← Back to the inbox
        </button>
        <dl className="eac-email-facts">
          <div>
            <dt>From</dt>
            <dd>
              {open.fromName ? `${open.fromName} ` : ""}
              &lt;{open.fromEmail}&gt;
            </dd>
          </div>
          <div>
            <dt>Arrived</dt>
            <dd>{fmt(open.receivedAt)}</dd>
          </div>
          <div>
            <dt>At</dt>
            <dd>{open.toEmail}</dd>
          </div>
        </dl>

        {/* Plain text in a <pre>, never dangerouslySetInnerHTML. See
            readableBody: this is a stranger's markup inside a signed-in
            session, and the text part says the same thing. */}
        <pre className="eac-email-body">{readableBody(open)}</pre>

        {open.attachments.length > 0 && (
          <ul className="eac-email-attachments">
            {open.attachments.map((a, i) => (
              <li key={i}>
                {a.url ? (
                  <a href={a.url} rel="noopener noreferrer nofollow">{a.name}</a>
                ) : (
                  a.name
                )}
                {a.size ? ` · ${Math.ceil(a.size / 1024)}KB` : ""}
              </li>
            ))}
          </ul>
        )}

        {canEdit && replyFor === open.id && connectors?.sendReply && (
          /*
            Replying in place, as the ORG.
            A mailto sends from whoever the browser's mail app is signed in as,
            so the recipient sees a person, the org's inbox never learns a
            reply happened, and the thread splits across someone's personal
            Sent folder. This posts through the host's route instead, which
            sends with the org identity and writes the ledger row the Activity
            tab reads.
          */
          <form
            className="eac-email-reply"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run("Reply sent", () =>
                connectors.sendReply!({
                  messageId: open.id,
                  subject: replySubject,
                  body: replyBody,
                })
              );
              if (ok) {
                setReplyFor(null);
                setReplyBody("");
                setReplySubject("");
              }
            }}
          >
            <label className="eac-email-label" htmlFor="eac-email-reply-subject">
              Subject
            </label>
            <input
              id="eac-email-reply-subject"
              className="eac-field"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
            />
            <label className="eac-email-label" htmlFor="eac-email-reply-body">
              Your reply — sent as {data.identity.fromName}
            </label>
            <textarea
              id="eac-email-reply-body"
              className="eac-field"
              rows={7}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={`Replying to ${open.fromEmail}`}
            />
            <div className="eac-email-rowactions">
              <button
                type="submit"
                className="eac-btn eac-btn--primary"
                disabled={busy || !replyBody.trim()}
              >
                {busy ? "Sending…" : "Send reply"}
              </button>
              <button
                type="button"
                className="eac-btn eac-btn--quiet"
                onClick={() => setReplyFor(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {canEdit && replyFor !== open.id && (
          <div className="eac-email-rowactions">
            {connectors?.sendReply ? (
              <button
                type="button"
                className="eac-btn eac-btn--primary"
                onClick={() => {
                  setReplyFor(open.id);
                  setReplyBody("");
                  setReplySubject(
                    open.subject?.startsWith("Re:")
                      ? open.subject
                      : `Re: ${open.subject ?? ""}`
                  );
                }}
              >
                Reply
              </button>
            ) : (
              /* No route wired on this host — hand the browser's mail app the
                 message rather than showing a button that cannot send. */
              <a
                className="eac-btn eac-btn--primary"
                href={`mailto:${encodeURIComponent(open.fromEmail)}?subject=${encodeURIComponent(
                  open.subject?.startsWith("Re:") ? open.subject : `Re: ${open.subject ?? ""}`
                )}`}
              >
                Reply
              </a>
            )}
            {connectors?.setMessageState && (
              <button
                type="button"
                className="eac-btn eac-btn--quiet"
                disabled={busy}
                onClick={() =>
                  run("Archived.", () =>
                    connectors.setMessageState!(open.id, "archived")
                  ).then((ok) => ok && setOpenId(null))
                }
              >
                Archive
              </button>
            )}
            {connectors?.reclassify && open.classification !== "spam" && (
              <button
                type="button"
                className="eac-btn eac-btn--danger"
                disabled={busy}
                onClick={() =>
                  run("Marked as spam.", () => connectors.reclassify!(open.id, "spam")).then(
                    (ok) => ok && setOpenId(null)
                  )
                }
              >
                Spam
              </button>
            )}
            {connectors?.reclassify && open.classification === "spam" && (
              <button
                type="button"
                className="eac-btn eac-btn--quiet"
                disabled={busy}
                onClick={() =>
                  run("Moved out of spam.", () => connectors.reclassify!(open.id, "enquiry"))
                }
              >
                Not spam
              </button>
            )}
          </div>
        )}
      </SurfaceSection>
    );
  }

  return (
    <SurfaceSection title={`Inbox · ${data.identity.inboundAddress}`}>
      {data.inbox.length === 0 ? (
        <p className="eac-surface-empty">
          Nothing has arrived yet. Mail to {data.identity.inboundAddress} lands here.
        </p>
      ) : (
        <ul className="eac-email-list">
          {data.inbox.map((m) => (
            <li key={m.id} className={`eac-email-item${m.state === "unread" ? " is-unread" : ""}`}>
              <button
                type="button"
                className="eac-email-item-open"
                onClick={() => {
                  setOpenId(m.id);
                  // Reading it IS marking it read; making that a second,
                  // separate action is how inboxes accumulate a permanent
                  // false badge.
                  if (m.state === "unread" && connectors?.setMessageState) {
                    void run("", () => connectors.setMessageState!(m.id, "read"));
                  }
                }}
              >
                <span className="eac-email-item-main">
                  <span className="eac-email-item-title">{m.subject || "(no subject)"}</span>
                  <span className="eac-email-item-sub">
                    {m.fromName ? `${m.fromName} · ` : ""}
                    {m.fromEmail}
                  </span>
                </span>
                <span className="eac-email-item-side">
                  <span className="eac-email-item-when">{fmt(m.receivedAt)}</span>
                  {m.classification !== "enquiry" && m.classification !== "reply" && (
                    <span className="eac-email-item-status">{m.classification}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SurfaceSection>
  );
}

// ── Addresses ───────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<EmailAddress["sources"][number], string> = {
  member: "member",
  guest: "guest",
  contact: "enquiry",
  manual: "added",
};

function AddressesTab({
  data,
  connectors,
  canEdit,
  run,
  busy,
  say,
}: {
  data: EmailSuiteData;
  connectors?: EmailConnectors;
  canEdit: boolean;
  run: (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
  busy: boolean;
  say: (m: string) => void;
}) {
  const [paste, setPaste] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const shown = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data.addresses;
    return data.addresses.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        (a.name ?? "").toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [data.addresses, filter]);

  const mailable = data.addresses.filter((a) => a.mailable).length;
  const off = data.addresses.length - mailable;

  async function submitPaste() {
    if (!paste.trim() || !connectors?.addAddresses) return;
    setAdding(true);
    try {
      const result = await connectors.addAddresses({ text: paste });
      if (!result.ok) return;
      // Reported rather than summarised as a number, because "4 added" hides
      // the two lines that were junk and the one who had unsubscribed — and
      // those are the only parts anyone needs to act on.
      const parts = [
        result.added ? `${result.added} added` : null,
        result.updated ? `${result.updated} already there` : null,
        result.skippedUnsubscribed
          ? `${result.skippedUnsubscribed} left alone (unsubscribed)`
          : null,
        result.rejected?.length ? `${result.rejected.length} not an address` : null,
      ].filter(Boolean);
      say(parts.join(" · ") || "Nothing to add.");
      setPaste("");
      await connectors.refresh?.();
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <SurfaceSection title={`${mailable} reachable${off ? ` · ${off} unsubscribed` : ""}`}>
        <p className="eac-surface-muted">
          Everyone this organisation can write to: the people who enquired, its
          members, the guests who came to something, and anyone added by hand.
          Nobody is copied between those — each is read where it lives, so a
          member who leaves leaves this list the same day.
        </p>

        {canEdit && connectors?.addAddresses && (
          <div className="eac-email-add">
            <label className="eac-email-label" htmlFor="eac-email-paste">
              Add addresses
            </label>
            <textarea
              id="eac-email-paste"
              className="eac-email-textarea"
              rows={3}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"one per line — jane@example.com, or Jane Doe <jane@example.com>"}
            />
            <button
              type="button"
              className="eac-btn eac-btn--primary"
              disabled={adding || !paste.trim()}
              onClick={submitPaste}
            >
              {adding ? "Adding…" : "Add to the list"}
            </button>
          </div>
        )}

        <label className="eac-email-label" htmlFor="eac-email-filter">
          Find
        </label>
        <input
          id="eac-email-filter"
          className="eac-email-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="name, address or tag"
        />
      </SurfaceSection>

      <SurfaceSection title={filter ? `${shown.length} matching` : "The list"}>
        {shown.length === 0 ? (
          <p className="eac-surface-empty">
            {filter ? "Nobody matches that." : "Nobody on the list yet."}
          </p>
        ) : (
          <ul className="eac-email-list">
            {shown.map((entry) => (
              <li
                key={entry.id}
                className={`eac-email-item${entry.mailable ? "" : " is-off"}`}
              >
                <span className="eac-email-item-main">
                  <span className="eac-email-item-title">
                    {entry.name || entry.email}
                  </span>
                  <span className="eac-email-item-sub">
                    {entry.name ? `${entry.email} · ` : ""}
                    {entry.sources.map((s) => SOURCE_LABEL[s]).join(", ")}
                    {entry.role ? ` · ${entry.role}` : ""}
                    {entry.tags.length ? ` · ${entry.tags.join(", ")}` : ""}
                  </span>
                </span>
                <span className="eac-email-item-side">
                  {entry.mailable ? (
                    canEdit && connectors?.suppressAddress ? (
                      <button
                        type="button"
                        className="eac-email-quietbtn"
                        disabled={busy}
                        onClick={() =>
                          run("Taken off the list.", () =>
                            connectors.suppressAddress!(entry.email)
                          )
                        }
                      >
                        Stop mailing
                      </button>
                    ) : null
                  ) : (
                    // Never offered as a button to undo. An unsubscribe is the
                    // person's decision, not the org's, and a one-click
                    // "resubscribe" in an admin console is how consent gets
                    // quietly reversed.
                    <span className="eac-email-item-status">unsubscribed</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SurfaceSection>
    </>
  );
}

// ── Letters ─────────────────────────────────────────────────────────────────

const OVERRIDE_LABEL = {
  default: "Network default",
  words: "Your words",
  layout: "Your layout",
} as const;

/**
 * Plain stored words → paragraphs the rich editor can open on.
 *
 * Every letter written before the editor existed holds plain `bodyText`. Handing
 * that to Tiptap raw would collapse the blank lines between paragraphs into one
 * run-on block the first time somebody re-saved, so the breaks are made explicit
 * here. Escaped, because this string goes into an editor as HTML and the words
 * are an org's own — a stray `<` in "opens <7pm" must stay a `<`.
 */
function textToHtml(text?: string | null): string {
  const value = (text ?? "").trim();
  if (!value) return "";
  return value
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p>${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`
    )
    .join("");
}

/**
 * A placeholder's worth of a block's default.
 *
 * A placeholder occupies exactly one line — editor.css clips it, and before
 * that clip a three-paragraph default drew itself over the whole column. So
 * the box is seeded with the opening clause and the default in full is
 * offered beside it, where length costs nothing.
 */
function firstLine(text: string, max = 88): string {
  const line = text.split(/\n/)[0]?.trim() ?? "";
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function LettersTab({
  data,
  connectors,
  canEdit,
}: {
  data: EmailSuiteData;
  connectors?: EmailConnectors;
  canEdit: boolean;
}) {
  const href = (template: string | undefined, key: string) =>
    template ? template.replace("{key}", encodeURIComponent(key)) : undefined;

  // ── The shape of this tab ────────────────────────────────────────────────
  //
  // Third attempt, and the first two are worth recording because the third is
  // a reaction to a measured failure rather than a preference.
  //
  //   1. A COLUMN OF ROWS that expanded in place. The thing you were editing
  //      and the thing you were editing it FOR were never legible at once,
  //      and the page grew by a screen and a half per row opened.
  //
  //   2. A RAIL AND A STAGE: the letters and every box that changed them in a
  //      23rem column on the left, the letter at full size on the right. The
  //      rail was a 52rem box with TWO nested scrollers inside it — the list,
  //      then the work on it — and eight rich-text editors in ~330px.
  //
  //      That shipped genuinely broken. Each editor took the block's network
  //      default as its placeholder, two of those are three paragraphs, and
  //      Tiptap draws a placeholder as a floated box of ZERO height: a 23px
  //      editor with 392px of placeholder text laid straight down over the
  //      labels, toolbars and boxes under it. Scrolling that column showed a
  //      pile of overlapping sentences. (The floated placeholder is fixed at
  //      source in editor.css; this layout is why it was never noticed.)
  //
  //   3. HERE. The letters are a row of chips across the top, and everything
  //      below is two wide columns: what the letter says on the left, the
  //      letter itself on the right. NOTHING scrolls but the page.
  //
  // That last clause is the design. A panel that scrolls inside a page that
  // also scrolls is two scrollbars deep before anyone has typed a word, and
  // it is what made a 23rem column seem like enough room for eight editors.
  // Give the boxes the width of half a screen and none of it is needed.

  const [selected, setSelected] = React.useState<string | null>(
    () => data.templates.find((t) => t.editable)?.key ?? data.templates[0]?.key ?? null
  );
  const [preview, setPreview] = React.useState<
    Record<string, { html?: string; error?: string } | "loading">
  >({});
  // The org's APPENDED section, per letter, as HTML.
  const [bodyDrafts, setBodyDrafts] = React.useState<Record<string, string>>({});
  // One letter's own sentences, keyed `<letter>:<slot>`. Prose holds HTML,
  // a line holds plain text — the control differs, so the draft does too.
  const [slotDrafts, setSlotDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const letter = data.templates.find((t) => t.key === selected) ?? null;
  const slots = letter?.slots ?? [];
  const fields = letter?.mergeFields ?? [];
  const editable = Boolean(letter?.editable && canEdit);
  const layoutHref = letter ? href(data.templateLayoutHref, letter.key) : undefined;

  function render(key: string) {
    if (!connectors?.previewTemplate) return;
    setPreview((p) => ({ ...p, [key]: "loading" }));
    void connectors
      .previewTemplate(key)
      .then((r) => setPreview((p) => ({ ...p, [key]: r })))
      .catch(() =>
        setPreview((p) => ({ ...p, [key]: { error: "Couldn't render that letter." } }))
      );
  }

  // Draw whichever letter is selected, once. The preview is the whole right
  // half of this tab, so unlike the old expanding rows there is never a moment
  // where nothing is shown.
  React.useEffect(() => {
    if (selected && !preview[selected]) render(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function pick(key: string) {
    setSelected(key);
    setStatus(null);
  }

  const slotKey = (id: string) => `${selected}:${id}`;

  /** What a block currently says — the draft, this org's words, or the network's. */
  function slotValue(slot: EmailCopySlot): string {
    const draft = slotDrafts[slotKey(slot.id)];
    if (draft !== undefined) return draft;
    if (slot.kind === "line") return slot.text ?? "";
    return slot.html ?? textToHtml(slot.text) ?? "";
  }

  function setSlot(id: string, value: string) {
    setSlotDrafts((d) => ({ ...d, [slotKey(id)]: value }));
    setStatus(null);
  }

  const bodyValue =
    selected === null
      ? ""
      : (bodyDrafts[selected] ?? letter?.bodyHtml ?? textToHtml(letter?.bodyText) ?? "");

  const dirty =
    selected !== null &&
    (bodyDrafts[selected] !== undefined ||
      slots.some((s) => slotDrafts[slotKey(s.id)] !== undefined));

  async function save() {
    if (!selected || !letter) return;
    setSaving(true);
    setStatus(null);
    try {
      // Each block through its own connector, and the appended section through
      // its own: they are different objects in the store, and writing one must
      // never disturb the other.
      for (const slot of slots) {
        const draft = slotDrafts[slotKey(slot.id)];
        if (draft === undefined) continue;
        if (!connectors?.saveCopy) continue;
        const text = slot.kind === "line" ? draft.trim() : emailHtmlToText(draft);
        const result = await connectors.saveCopy(
          selected,
          slot.id,
          text,
          slot.kind === "line" ? undefined : text ? draft : ""
        );
        if (!result.ok) {
          setStatus(result.error ?? `Couldn't save “${slot.label}”.`);
          return;
        }
      }

      if (bodyDrafts[selected] !== undefined && connectors?.saveTemplate) {
        const html = bodyDrafts[selected] ?? "";
        const text = emailHtmlToText(html);
        const result = await connectors.saveTemplate(selected, text, text ? html : "");
        if (!result.ok) {
          setStatus(result.error ?? "Couldn't save.");
          return;
        }
      }

      setStatus("Saved.");
      setSlotDrafts({});
      setBodyDrafts({});
      // Re-render, because the preview's whole claim is that it shows what
      // will actually send — and it just changed.
      render(selected);
      await connectors?.refresh?.();
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setSlotDrafts({});
    setBodyDrafts({});
    setStatus(null);
  }

  /** Put a token on the clipboard, so it can be pasted into any box. */
  function copyToken(name: string) {
    const token = `{${name}}`;
    try {
      void navigator.clipboard?.writeText(token);
      setCopied(name);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // A clipboard an iframe is not allowed to touch is not an error worth
      // reporting — the token is written on the chip, and it can be typed.
      setCopied(null);
    }
  }

  const shown = selected ? preview[selected] : undefined;

  return (
    <div className="eac-letters">
      {/* The letters, as a row.

          There are eight of them and their titles are two or three words, so
          a 23rem vertical rail spent a fifth of the screen's width on a list
          that fits on one line. Across the top it costs one row, and the two
          columns underneath each gain about 150px — which is the difference
          between a rich-text box you can write a paragraph in and one you
          cannot. */}
      <nav className="eac-letters-pickers" aria-label="Letters">
        {data.templates.map((t) => (
          <button
            key={t.key}
            type="button"
            className="eac-letters-pick"
            aria-current={t.key === selected ? "true" : undefined}
            onClick={() => pick(t.key)}
          >
            <span className="eac-letters-pick-title">{t.title}</span>
            <span className={`eac-letters-state is-${t.override}`}>
              {OVERRIDE_LABEL[t.override]}
            </span>
          </button>
        ))}
      </nav>

      {letter && (
        <div className="eac-letters-head">
          <div className="eac-letters-headtext">
            <h3>{letter.title}</h3>
            <p className="eac-email-hint">
              {letter.trigger}. Goes to {letter.recipient.toLowerCase()}.
            </p>
          </div>

          {/* The way through to the layout editor, as a BUTTON and at the top.

              It was one line of small print at the very bottom of a column
              that scrolled — "Lay the whole thing out yourself" — under eight
              editors, which is to say invisible. It is the one control here
              that opens a different tool, so it belongs where a control that
              leaves the page belongs: beside the title of the thing it would
              open. */}
          {layoutHref && letter.editable && canEdit && (
            <a className="eac-btn eac-btn--primary eac-letters-open" href={layoutHref}>
              Open in Editor
              <span className="eac-email-hint">
                {letter.override === "layout"
                  ? "your own layout is what sends"
                  : "lay the whole letter out yourself"}
              </span>
            </a>
          )}
        </div>
      )}

      {letter && (
        <div className="eac-letters-body">
          <section className="eac-letters-work" aria-label="What this letter says">
            {!editable && (
              <p className="eac-email-hint">
                {letter.editable
                  ? "Only this organisation's owners and guides can change what it says."
                  : "This letter goes to you rather than out, so there is nothing to word."}
              </p>
            )}

            {editable && fields.length > 0 && (
              // One wrapping strip, not a disclosure.
              //
              // It was a <details> that cost ~200px open at the top of a
              // column with ~400px to give, so the first box you could type
              // in started below the fold — and closed it was a row that said
              // nothing. In a full-width column the chips wrap onto one or
              // two lines and are simply always there.
              <div className="eac-letters-tokens">
                <span className="eac-email-label">Fills in when it sends</span>
                <div className="eac-letters-chips">
                  {fields.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      className="eac-letters-chip"
                      title={`${f.label} — click to copy`}
                      onClick={() => copyToken(f.name)}
                    >
                      {copied === f.name ? "copied" : `{${f.name}}`}
                    </button>
                  ))}
                </div>
                <span className="eac-email-hint">
                  Put one of these anywhere in the boxes below and it becomes
                  the real value for each person.
                </span>
              </div>
            )}

            {editable && slots.length > 0 && connectors?.saveCopy && (
              <div className="eac-letters-slots">
                <span className="eac-email-label">What this letter says</span>
                {slots.map((slot) => (
                  <div key={slot.id} className="eac-letters-slot">
                    <span className="eac-letters-slot-label">{slot.label}</span>
                    <span className="eac-email-hint">{slot.hint}</span>
                    {slot.kind === "line" ? (
                      <input
                        className="eac-email-input"
                        value={slotValue(slot)}
                        placeholder={slot.fallback}
                        onChange={(e) => setSlot(slot.id, e.target.value)}
                      />
                    ) : (
                      <>
                        <RichTextEditor
                          value={slotValue(slot)}
                          onChange={(html) => setSlot(slot.id, html)}
                          toolbar="compact"
                          minHeight={120}
                          ariaLabel={slot.label}
                          placeholder={firstLine(slot.fallback)}
                        />
                        {/* The network's words, in full, BESIDE the box
                            rather than inside it as a placeholder.

                            A placeholder is one line — it has to be, or it
                            escapes the box it belongs to. But these defaults
                            are three paragraphs and they are the thing an org
                            is deciding whether to replace, so they have to be
                            readable somewhere. Here, where they can be as
                            long as they are. */}
                        {!slotValue(slot) && slot.fallback.length > 90 && (
                          <details className="eac-letters-default">
                            <summary>What it says today</summary>
                            {slot.fallback.split("\n\n").map((para, i) => (
                              <p key={i}>{para}</p>
                            ))}
                          </details>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editable && connectors?.saveTemplate && (
              <div className="eac-letters-slot eac-letters-own">
                <span className="eac-email-label">Anything of your own</span>
                <span className="eac-email-hint">
                  {letter.editHint ??
                    "Added as its own section, under the letter's own words."}
                </span>
                <RichTextEditor
                  value={bodyValue}
                  onChange={(html) =>
                    setBodyDrafts((d) => ({ ...d, [selected as string]: html }))
                  }
                  toolbar="compact"
                  minHeight={140}
                  ariaLabel="Anything of your own"
                  placeholder="Leave empty to send only the letter above."
                />
              </div>
            )}

            {editable && (
              <div className="eac-letters-actions">
                <button
                  type="button"
                  className="eac-btn eac-btn--primary"
                  disabled={saving || !dirty}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                {dirty && (
                  <button type="button" className="eac-btn eac-btn--quiet" onClick={revert}>
                    Undo
                  </button>
                )}
                {connectors?.testTemplate && (
                  <button
                    type="button"
                    className="eac-btn eac-btn--quiet"
                    onClick={() => void connectors.testTemplate!(selected as string)}
                  >
                    Send me one
                  </button>
                )}
                {status && <span className="eac-email-hint">{status}</span>}
              </div>
            )}
          </section>

          <section className="eac-letters-stage" aria-label="What sends today">
            <div className="eac-letters-stagehead">
              <span className="eac-email-label">{letter.title} — what sends today</span>
              {data.newsletterHref && (
                <a className="eac-letters-deep" href={data.newsletterHref}>
                  Write a newsletter
                </a>
              )}
            </div>

            {shown === "loading" && <p className="eac-surface-muted">Rendering…</p>}
            {typeof shown === "object" && shown !== null ? (
              shown.html ? (
                <iframe
                  title={`${letter.title} preview`}
                  srcDoc={shown.html}
                  // sandbox with NO allow-scripts. This is HTML an org owner
                  // composed, rendered inside a signed-in session — the one place
                  // in the product where stored markup and a live session meet.
                  sandbox=""
                  className="eac-letters-frame"
                />
              ) : (
                <p className="eac-surface-muted">{shown.error}</p>
              )
            ) : shown === undefined ? (
              <p className="eac-surface-muted">Pick a letter to see it.</p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

// ── Look ────────────────────────────────────────────────────────────────────

/**
 * Relative luminance, per WCAG 2.1. Used to check the org's own accent against
 * the ink it chose, because "white on the brand colour" is the single most
 * common contrast failure on this network and a colour picker that does not
 * measure is a colour picker that ships 1.7:1 headings.
 */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The letter's fixed chrome, from EmailShell. The masthead ground is part of
 * the network's house style and is not an org's to change — so it is the
 * constant an org's accent has to be readable against, not a variable.
 */
const EAC_MASTHEAD = "#01124E";
const EAC_GOLD = "#b79a55";
const EAC_INK = "#022278";

function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function LookTab({
  data,
  connectors,
  canEdit,
  run,
  busy,
}: {
  data: EmailSuiteData;
  connectors?: EmailConnectors;
  canEdit: boolean;
  run: (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
  busy: boolean;
}) {
  const palette = data.identity.palette ?? {};
  const [accent, setAccent] = React.useState(palette.accent ?? EAC_GOLD);
  // NOT white. The default was #ffffff and the checker below immediately said
  // 2.70:1 against the collective's gold — the exact white-on-brand-colour
  // failure that keeps shipping here. The house ink passes at 5.17:1.
  const [onAccent, setOnAccent] = React.useState(palette.onAccent ?? EAC_INK);
  const [ink, setInk] = React.useState(palette.ink ?? EAC_INK);
  const [bodyFont, setBodyFont] = React.useState(palette.bodyFont ?? "");
  const fonts = data.identity.fonts ?? [];
  const [replyTo, setReplyTo] = React.useState(data.identity.replyTo ?? "");
  const [routeIn, setRouteIn] = React.useState(data.identity.inboundReplies);

  // ── The masthead and the frame ──────────────────────────────────────────
  //
  // Moved here 2026-09-20, with the faces and the colours, because all four
  // are one decision — what an org's mail LOOKS like — and none of them is
  // per-letter. They were nowhere at all before; the only route to a letter
  // that did not wear the collective's navy-and-gold masthead was to rebuild
  // the whole thing in the layout editor.
  const [bannerUrl, setBannerUrl] = React.useState(palette.bannerUrl ?? "");
  const [bannerAlt, setBannerAlt] = React.useState(palette.bannerAlt ?? "");
  const [frameColor, setFrameColor] = React.useState(palette.frameColor ?? EAC_GOLD);
  const [frameWidth, setFrameWidth] = React.useState(palette.frameWidth ?? 1);

  // https only, matching what the store will accept (identity.ts's IMAGE_URL).
  // Checked as you type rather than on save, because the failure mode this
  // replaces is a save that reports success and changes nothing: the store
  // drops a value that does not pass, so a silent drop looked exactly like a
  // broken save.
  const bannerTrimmed = bannerUrl.trim();
  const bannerOk = bannerTrimmed === "" || /^https:\/\/[^\s"'<>]+$/i.test(bannerTrimmed);

  // Two pairs, because the template uses the accent two different ways and
  // only one of them is a fill. The masthead sets the org's colour as INK on a
  // fixed navy ground (EmailShell:187-206) — that is the pair that decides
  // whether an org's name is readable in the inbox. The other is a button,
  // where the accent IS the ground.
  const onHeader = contrastRatio(accent, EAC_MASTHEAD);
  const onFill = contrastRatio(onAccent, accent);

  return (
    <>
      <SurfaceSection title="They arrive as">
        <dl className="eac-email-facts">
          <div>
            <dt>From</dt>
            <dd>
              {data.identity.fromName} &lt;{data.identity.fromEmail}&gt;
            </dd>
          </div>
          <div>
            <dt>Replies go to</dt>
            <dd>{data.identity.replyTo || "the sending address"}</dd>
          </div>
          <div>
            <dt>Notifications reach</dt>
            <dd>{data.identity.ownerEmails.join(", ") || "nobody yet"}</dd>
          </div>
        </dl>
        {!data.identity.fromIsOrgDomain && (
          <p className="eac-surface-muted">
            This organisation doesn&rsquo;t send from its own domain yet, so the
            collective&rsquo;s address carries the mail. The name above is still
            yours — nothing here needs changing when the domain is
            authenticated.
          </p>
        )}
      </SurfaceSection>

      {canEdit && connectors?.saveIdentity && (
        <SurfaceSection title="The top of the letter">
          <p className="eac-surface-muted">
            Your own masthead, in place of the collective&rsquo;s navy-and-gold
            wordmark. Use the same picture your website leads with and a letter
            and the site it came from read as one thing. Leave it empty and
            your mail wears the collective&rsquo;s.
          </p>

          <label className="eac-email-label" htmlFor="eac-email-banner">
            Banner image address
          </label>
          <input
            id="eac-email-banner"
            className="eac-email-input"
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://example.org/banner.jpg"
            spellCheck={false}
            aria-invalid={bannerOk ? undefined : true}
          />
          <p className="eac-surface-muted">
            {/* An email cannot reach a relative path or a private host: it is
                fetched by a mail client, from wherever the reader is, hours
                later. So the address has to be the public one, and https —
                which is exactly the mistake somebody copying an image
                address out of a page editor would make. */}
            It has to be a public <code>https://</code> address — a mail client
            fetches it from the reader&rsquo;s machine, not from this site.
            About 600&nbsp;pixels wide suits the letter; anything wider is
            scaled down to fit.
          </p>
          {!bannerOk && (
            <p className="eac-email-contrast is-bad">
              <strong>That address will not be saved.</strong>
              <span className="eac-email-hint">
                It has to begin with https:// and contain no spaces or quotes.
              </span>
            </p>
          )}

          <label className="eac-email-label" htmlFor="eac-email-banner-alt">
            What the picture says
          </label>
          <input
            id="eac-email-banner-alt"
            className="eac-email-input"
            value={bannerAlt}
            onChange={(e) => setBannerAlt(e.target.value)}
            placeholder={data.orgName}
          />
          <p className="eac-surface-muted">
            {/* Not an accessibility afterthought: Outlook and Gmail both
                block remote images by DEFAULT, so for a large share of
                readers this text IS the masthead. */}
            Shown instead of the picture by the many inboxes that block images
            until a reader asks for them — so for a good share of your readers
            this line is the masthead. Leave it empty to use your name.
          </p>

          {bannerOk && bannerTrimmed && (
            /* Drawn as the letter draws it: full width of a 600px column, on
               the same navy the masthead band sits on. A banner that looks
               right in a file browser and wrong at 600px is the thing this
               catches. */
            <div className="eac-email-bannerdemo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerTrimmed} alt={bannerAlt || data.orgName} />
            </div>
          )}

          <div className="eac-email-palette">
            <Swatch
              label="Frame"
              hint="the rule around the card"
              value={frameColor}
              onChange={setFrameColor}
            />
            <div className="eac-email-swatch">
              <label className="eac-email-label" htmlFor="eac-email-framew">
                Frame thickness
              </label>
              <select
                id="eac-email-framew"
                className="eac-email-input"
                value={String(frameWidth)}
                onChange={(e) => setFrameWidth(Number(e.target.value))}
              >
                <option value="1">Hairline (1px)</option>
                <option value="2">Medium (2px)</option>
                <option value="3">Heavy (3px)</option>
                <option value="4">Very heavy (4px)</option>
              </select>
              <span className="eac-email-hint">
                Matches a frame your site already uses, if it has one.
              </span>
            </div>
          </div>

          <div
            className="eac-email-framedemo"
            style={{ borderWidth: `${frameWidth}px`, borderColor: frameColor }}
          >
            The letter sits inside this.
          </div>

          <button
            type="button"
            className="eac-btn eac-btn--primary"
            disabled={busy || !bannerOk}
            onClick={() =>
              run("Masthead saved.", () =>
                connectors.saveIdentity!({
                  palette: {
                    // Empty string clears one role and leaves the rest —
                    // saveOrgEmailIdentity merges the palette per field, so
                    // taking a banner off no longer costs the colours.
                    bannerUrl: bannerTrimmed,
                    bannerAlt: bannerAlt.trim(),
                    frameColor,
                    frameWidth,
                  },
                })
              )
            }
          >
            Save the masthead
          </button>
        </SurfaceSection>
      )}

      {canEdit && connectors?.saveIdentity && fonts.length > 0 && (
        <SurfaceSection title="How it reads">
          <p className="eac-surface-muted">
            The face your letters are set in. Every one of these is installed on
            more or less every phone and desktop — which is the point: a mail
            client that has to substitute a face substitutes badly, and the
            letter arrives looking like a form.
          </p>
          <div className="eac-email-fonts">
            {fonts.map((f) => (
              <button
                key={f.id}
                type="button"
                className="eac-email-font"
                aria-pressed={bodyFont === f.id || (!bodyFont && f.id === "sans")}
                onClick={() => setBodyFont(f.id)}
              >
                <span
                  className="eac-email-font-sample"
                  // The only place in the suite where a font stack is set from
                  // data — and the ids come from the sending package, which
                  // owns every stack, so there is no free string here.
                  data-font={f.id}
                >
                  The next viewing is on the 3rd.
                </span>
                <span className="eac-email-font-name">{f.label}</span>
                <span className="eac-email-hint">{f.hint}</span>
              </button>
            ))}
          </div>

          {/* Its own Save. The face used to be written by the "Save colours"
              button two sections down, which meant picking one and pressing
              the obvious button under it did nothing at all. Possible now
              only because saveOrgEmailIdentity merges the palette per field
              rather than replacing it whole. */}
          <button
            type="button"
            className="eac-btn eac-btn--primary"
            disabled={busy}
            onClick={() =>
              run("Face saved.", () =>
                connectors.saveIdentity!({ palette: { bodyFont: bodyFont || "sans" } })
              )
            }
          >
            Save the face
          </button>
        </SurfaceSection>
      )}

      {canEdit && connectors?.saveIdentity && (
        <>
          <SurfaceSection title="Your colours">
            <p className="eac-surface-muted">
              Three roles, because an email is a card on a page and one colour
              can&rsquo;t carry it. Leave them and your mail wears the
              collective&rsquo;s gold and navy.
            </p>

            <div className="eac-email-palette">
              <Swatch label="Accent" hint="rules, headings, buttons" value={accent} onChange={setAccent} />
              <Swatch label="On accent" hint="text ON the accent" value={onAccent} onChange={setOnAccent} />
              <Swatch label="Ink" hint="body text" value={ink} onChange={setInk} />
            </div>

            {/* Measured, not eyeballed. White on a mid accent is the recurring
                failure here and it has shipped at 1.7:1 more than once — this
                very form defaulted to it until the checker said so. */}
            <Verdict
              label="Your name in the masthead"
              ratio={onHeader}
              note="your accent on the letter's navy header"
            />
            <Verdict
              label="Text on a button"
              ratio={onFill}
              note="your on-accent colour where the accent is the fill"
            />

            {/* Both demos, because both are things the letter actually does
                and a single swatch would only show one of them. */}
            <div className="eac-email-demos">
              <div
                className="eac-email-swatchdemo"
                style={{ background: EAC_MASTHEAD, color: accent }}
              >
                {data.orgName}
              </div>
              <div
                className="eac-email-swatchdemo"
                style={{ background: accent, color: onAccent }}
              >
                A button
              </div>
            </div>

            <button
              type="button"
              className="eac-btn eac-btn--primary"
              disabled={busy}
              onClick={() =>
                run("Colours saved.", () =>
                  connectors.saveIdentity!({
                    palette: { accent, onAccent, ink, bodyFont: bodyFont || undefined },
                  })
                )
              }
            >
              Save colours
            </button>
          </SurfaceSection>

          <SurfaceSection title="Where replies go">
            <label className="eac-email-label" htmlFor="eac-email-replyto">
              Reply-to address
            </label>
            <input
              id="eac-email-replyto"
              className="eac-email-input"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="whoever@example.com"
            />
            <p className="eac-surface-muted">
              When somebody hits Reply on one of your letters, this is where it
              lands. Leave it blank and replies go to the sending address.
            </p>

            {data.identity.inboundAddress && (
              <label className="eac-email-check">
                <input
                  type="checkbox"
                  checked={routeIn}
                  onChange={(e) => setRouteIn(e.target.checked)}
                />
                <span>
                  Route replies into this website instead
                  <span className="eac-email-hint">
                    They arrive at {data.identity.inboundAddress} and appear in
                    the Inbox tab, where every guide can see them — rather than
                    in one person&rsquo;s mail.
                  </span>
                </span>
              </label>
            )}

            <button
              type="button"
              className="eac-btn eac-btn--primary"
              disabled={busy}
              onClick={() =>
                run("Saved.", () =>
                  connectors.saveIdentity!({
                    // Empty string clears it — see saveOrgEmailIdentity, where
                    // undefined means "leave alone" and null/'' means "clear".
                    replyTo: replyTo.trim() || null,
                    inboundReplies: routeIn,
                  })
                )
              }
            >
              Save
            </button>
          </SurfaceSection>
        </>
      )}
    </>
  );
}

/** One measured pair, with the number and the word. Never colour alone. */
function Verdict({
  label,
  ratio,
  note,
}: {
  label: string;
  ratio: number | null;
  note: string;
}) {
  const passes = ratio !== null && ratio >= 4.5;
  return (
    <p className={`eac-email-contrast${ratio === null ? "" : passes ? " is-ok" : " is-bad"}`}>
      <strong>{label}:</strong>{" "}
      {ratio === null
        ? "enter a hex colour to check it"
        : `${ratio.toFixed(2)}:1 — ${passes ? "passes AA" : "fails AA, 4.5:1 needed"}`}
      <span className="eac-email-hint">{note}</span>
    </p>
  );
}

function Swatch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `eac-email-swatch-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="eac-email-swatch">
      <label className="eac-email-label" htmlFor={id}>
        {label}
      </label>
      <div className="eac-email-swatch-row">
        <input
          id={id}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="eac-email-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
          spellCheck={false}
        />
      </div>
      <span className="eac-email-hint">{hint}</span>
    </div>
  );
}

/**
 * The popup adaptor.
 *
 * Registered by a host as `connectors.custom.email`, so the tile opens this in
 * the shared dialog like every other surface. The data and connectors come
 * through the descriptor's props, which is what lets one component serve both
 * the popup and the page without the package learning anything about routes.
 */
export function EmailCustomSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const props = (descriptor.props ?? {}) as {
    data?: EmailSuiteData;
    connectors?: EmailConnectors;
    canEdit?: boolean;
    tab?: EmailTab;
  };

  if (!props.data) {
    return (
      <SurfaceFrame kind="neutral" title="Email">
        <p className="eac-surface-empty">This site has not supplied its email data.</p>
      </SurfaceFrame>
    );
  }

  return (
    <EmailSurface
      data={props.data}
      connectors={props.connectors}
      canEdit={props.canEdit ?? true}
      tab={props.tab ?? "activity"}
    />
  );
}
