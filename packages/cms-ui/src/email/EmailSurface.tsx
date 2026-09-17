"use client";

import * as React from "react";
import { SurfaceFrame, SurfaceSection, type SurfaceDescriptor } from "../surface";
import type {
  EmailConnectors,
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

        {canEdit && (
          <div className="eac-email-rowactions">
            {/* mailto and not an in-app composer: replying from the org's
                address needs the identity, the templates and a send — that is
                the newsletter editor's job, and a half-composer here would be
                a fifth attempt at the thing this suite exists to consolidate. */}
            <a
              className="eac-btn eac-btn--primary"
              href={`mailto:${encodeURIComponent(open.fromEmail)}?subject=${encodeURIComponent(
                open.subject?.startsWith("Re:") ? open.subject : `Re: ${open.subject ?? ""}`
              )}`}
            >
              Reply
            </a>
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

  // Which letter is open, and its rendered HTML once it arrives. One at a
  // time, loaded on demand: rendering all eight up front would make everyone
  // who opens the hub pay for the one person who opened this tab.
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<
    Record<string, { html?: string; error?: string } | "loading">
  >({});
  // The org's own words, per letter, while being edited. Seeded from whatever
  // the host passed in `bodyText`; `undefined` means "not touched yet".
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

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

  function toggle(key: string) {
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    setSaved(null);
    if (!preview[key]) render(key);
  }

  async function save(key: string) {
    if (!connectors?.saveTemplate) return;
    setSaving(key);
    setSaved(null);
    try {
      const result = await connectors.saveTemplate(key, drafts[key] ?? "");
      if (!result.ok) {
        setSaved(result.error ?? "Couldn't save.");
        return;
      }
      setSaved("Saved.");
      // Re-render, because the preview's whole claim is that it shows what
      // will actually send — and it just changed.
      render(key);
      await connectors.refresh?.();
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <SurfaceSection title="A newsletter">
        <p className="eac-surface-muted">
          The letters below are sent for you, when something happens. A
          newsletter is one you write and send yourself, to everyone on the
          list.
        </p>
        {data.newsletterHref ? (
          <a className="eac-btn eac-btn--primary" href={data.newsletterHref}>
            Open the newsletter editor
          </a>
        ) : (
          <p className="eac-surface-muted">
            The editor is not wired into this site yet.
          </p>
        )}
      </SurfaceSection>

      <SurfaceSection title="Every letter this organisation sends">
        <ul className="eac-email-list">
          {data.templates.map((t) => (
            <li key={t.key} className="eac-email-item">
              <span className="eac-email-item-main">
                <span className="eac-email-item-title">{t.title}</span>
                <span className="eac-email-item-sub">
                  {t.trigger} · to {t.recipient}
                </span>
                {t.editable && href(data.templateLayoutHref, t.key) && (
                  <span className="eac-email-item-links">
                    {/* Only the LAYOUT editor is still a link. It is GrapesJS —
                        a page's worth of client code — so it stays a route,
                        and a host that does not serve one shows no link rather
                        than a 404. Writing the words happens right here. */}
                    <a href={href(data.templateLayoutHref, t.key)}>Lay it out yourself</a>
                  </span>
                )}
              </span>
              <span className="eac-email-item-side">
                <span
                  className={`eac-email-item-status${
                    t.override === "default" ? " is-faint" : ""
                  }`}
                >
                  {OVERRIDE_LABEL[t.override]}
                </span>
                {connectors?.previewTemplate && (
                  <button
                    type="button"
                    className="eac-email-quietbtn"
                    aria-expanded={openKey === t.key}
                    onClick={() => toggle(t.key)}
                  >
                    {openKey === t.key ? "Hide" : canEdit ? "Read & edit" : "Read it"}
                  </button>
                )}
              </span>

              {openKey === t.key && (
                <div className="eac-email-preview">
                  {/* Write the org's own words beside the letter they land in,
                      rather than on another page. A connector has no route in
                      it, so this one editor serves a single-tenant site and an
                      org-switching console alike. */}
                  {t.editable && canEdit && connectors?.saveTemplate && (
                    <div className="eac-email-words">
                      <label className="eac-email-label" htmlFor={`words-${t.key}`}>
                        Your own words
                      </label>
                      <textarea
                        id={`words-${t.key}`}
                        className="eac-email-textarea"
                        rows={4}
                        value={drafts[t.key] ?? t.bodyText ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [t.key]: e.target.value }))
                        }
                        placeholder="Leave empty to send the network's words."
                      />
                      {t.editHint && <span className="eac-email-hint">{t.editHint}</span>}
                      <div className="eac-email-rowactions">
                        <button
                          type="button"
                          className="eac-btn eac-btn--primary"
                          disabled={saving === t.key}
                          onClick={() => void save(t.key)}
                        >
                          {saving === t.key ? "Saving…" : "Save these words"}
                        </button>
                        {connectors.testTemplate && (
                          <button
                            type="button"
                            className="eac-btn eac-btn--quiet"
                            onClick={() => void connectors.testTemplate!(t.key)}
                          >
                            Send me one
                          </button>
                        )}
                        {saved && openKey === t.key && (
                          <span className="eac-email-hint">{saved}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {preview[t.key] === "loading" && (
                    <p className="eac-surface-muted">Rendering…</p>
                  )}
                  {typeof preview[t.key] === "object" && preview[t.key] !== null && (
                    (preview[t.key] as { html?: string; error?: string }).html ? (
                      <iframe
                        title={`${t.title} preview`}
                        srcDoc={(preview[t.key] as { html: string }).html}
                        // sandbox with NO allow-scripts. This is HTML an org
                        // owner composed in the newsletter editor, rendered
                        // inside a signed-in session — the one place in the
                        // product where stored markup and a live session meet.
                        sandbox=""
                        className="eac-email-preview-frame"
                      />
                    ) : (
                      <p className="eac-surface-muted">
                        {(preview[t.key] as { error?: string }).error}
                      </p>
                    )
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </SurfaceSection>
    </>
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
  const [replyTo, setReplyTo] = React.useState(data.identity.replyTo ?? "");
  const [routeIn, setRouteIn] = React.useState(data.identity.inboundReplies);

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
                  connectors.saveIdentity!({ palette: { accent, onAccent, ink } })
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
