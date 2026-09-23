"use client";

import * as React from "react";
import { emailHtmlToText } from "@elkdonis/utils/html-to-text";
import { RichTextEditor } from "../editor";

// ============================================================================
// "Your words" — one letter's org-authored section, on a page.
//
// The suite's Letters tab has this same editor inline, beside the preview.
// This is the PAGE version, for hosts that serve `/hub/email/<key>`, and it is
// here rather than in each app because there were already two copies of it
// (innergathering's EmailTemplateForm, and the form IFAC did not have because
// IFAC had no email pages at all) and the moment it became rich text they
// would have been two different editors over the same field.
//
// Presentational, like the rest of this package: the host passes endpoints and
// this posts to them. It does not know which org it is writing for — the route
// does, from the session.
// ============================================================================

export interface TemplateWordsEditorProps {
  /** Which letter. Sent in the body for nothing; the endpoints carry it. */
  templateKey: string;
  /** What the org says today, as rich text. Wins over `initialBodyText`. */
  initialBodyHtml?: string | null;
  /** What the org said before the rich editor existed. */
  initialBodyText?: string | null;
  /** Where the org's words land in this letter, in a sentence. */
  hint?: string;
  /** Whether a layout composed in the newsletter editor is already winning. */
  hasOwnLayout?: boolean;
  /** The layout editor for this letter, when the host serves one. */
  editHref?: string;
  /** PUT { bodyText, bodyHtml }. */
  saveEndpoint: string;
  /** POST — sends this letter to the signed-in editor. */
  testEndpoint?: string;
}

/** Stored plain words → paragraphs the rich editor can open on, escaped. */
function textToHtml(text?: string | null): string {
  const value = (text ?? "").trim();
  if (!value) return "";
  return value
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    )
    .join("");
}

export function TemplateWordsEditor({
  initialBodyHtml,
  initialBodyText,
  hint,
  hasOwnLayout,
  editHref,
  saveEndpoint,
  testEndpoint,
}: TemplateWordsEditorProps) {
  const [html, setHtml] = React.useState(
    () => initialBodyHtml?.trim() || textToHtml(initialBodyText)
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  async function save() {
    setBusy("save");
    setStatus(null);
    // Both layers, derived from one. `bodyText` is never typed by hand, so the
    // plain fallback and the rich version cannot drift apart.
    const text = emailHtmlToText(html);
    try {
      const res = await fetch(saveEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: text, bodyHtml: text ? html : "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus(
        res.ok
          ? text
            ? "Saved. Reload to see the preview update."
            : "Cleared — this letter is back to the network's words."
          : (data.error ?? "Could not save.")
      );
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!testEndpoint) return;
    setBusy("test");
    setStatus(null);
    try {
      const res = await fetch(testEndpoint, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { to?: string; error?: string };
      setStatus(res.ok ? `Sent to ${data.to}.` : (data.error ?? "Could not send."));
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="eac-email-words">
      <span className="eac-email-label">Your words</span>
      {hint && <p className="eac-email-hint">{hint}</p>}

      {/* `compact` — marks, lists, quote and link. Deliberately not the full
          toolbar: tables, code blocks and video embeds either do not render in
          Outlook or get the whole message treated as suspicious, so offering
          them here would be offering something that breaks on arrival. */}
      <RichTextEditor
        value={html}
        onChange={setHtml}
        toolbar="compact"
        minHeight={220}
        ariaLabel="Your words for this letter"
        placeholder="Leave this empty to send only the words the network supplies."
      />

      <div className="eac-email-rowactions">
        <button
          type="button"
          className="eac-btn eac-btn--primary"
          disabled={busy === "save"}
          onClick={() => void save()}
        >
          {busy === "save" ? "Saving…" : "Save these words"}
        </button>

        {testEndpoint && (
          <button
            type="button"
            className="eac-btn eac-btn--quiet"
            disabled={busy === "test"}
            onClick={() => void sendTest()}
          >
            {busy === "test" ? "Sending…" : "Send me one"}
          </button>
        )}

        {editHref && (
          <a className="eac-btn eac-btn--quiet" href={editHref}>
            {hasOwnLayout ? "Edit the layout" : "Lay it out yourself"}
          </a>
        )}
      </div>

      {status && <p className="eac-email-hint">{status}</p>}

      {hasOwnLayout && (
        <p className="eac-email-hint">
          This letter has its own layout, composed in the editor. That layout is
          what sends — these words are kept, but a laid-out letter does not show
          them unless the layout includes them.
        </p>
      )}
    </div>
  );
}
