"use client";

import { useState } from "react";

/**
 * Live React island injected into <eac-embed data-eac-component="inquiry"> on a
 * Silex-published org page (see embeds.tsx). Self-styled to sit inside the dark
 * Enneagram template: it reads the template's --eac-enn-* CSS variables with
 * safe fallbacks so it also looks right on any other surface. Posts to the
 * org-scoped endpoint /api/org/[slug]/contact, which every host app exposes via
 * handleOrgContact.
 */

type Status = "idle" | "sending" | "done" | "error";

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--eac-enn-bg-soft, rgba(255,255,255,0.04))",
  border: "1px solid var(--eac-enn-line, rgba(255,255,255,0.18))",
  borderRadius: "8px",
  color: "var(--eac-enn-ink, #ece7dd)",
  fontFamily: "var(--eac-enn-body, inherit)",
  fontSize: "16px",
  lineHeight: 1.5,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  letterSpacing: "0.04em",
  color: "var(--eac-enn-ink-soft, #bcb6aa)",
};

export function InquiryForm({
  orgSlug,
  title = "Send your inquiry",
}: {
  orgSlug: string;
  title?: string;
}) {
  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
    newsletter: false,
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set<K extends keyof typeof fields>(key: K, val: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("done");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p
        style={{
          padding: "28px",
          border: "1px solid var(--eac-enn-line, rgba(255,255,255,0.18))",
          borderRadius: "10px",
          background: "var(--eac-enn-bg-soft, rgba(255,255,255,0.04))",
          color: "var(--eac-enn-ink, #ece7dd)",
          fontFamily: "var(--eac-enn-body, inherit)",
          fontSize: "18px",
          textAlign: "center",
        }}
      >
        Thank you — your message is on its way. We&apos;ll be in touch soon.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={title}
      style={{ display: "grid", gap: "20px", fontFamily: "var(--eac-enn-body, inherit)" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <label style={label} htmlFor="iq-first">
            First Name
          </label>
          <input
            id="iq-first"
            style={field}
            type="text"
            autoComplete="given-name"
            value={fields.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </div>
        <div>
          <label style={label} htmlFor="iq-last">
            Last Name
          </label>
          <input
            id="iq-last"
            style={field}
            type="text"
            autoComplete="family-name"
            value={fields.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label style={label} htmlFor="iq-email">
          Email <span aria-hidden>*</span>
        </label>
        <input
          id="iq-email"
          style={field}
          type="email"
          required
          autoComplete="email"
          value={fields.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>

      <div>
        <label style={label} htmlFor="iq-subject">
          Subject
        </label>
        <input
          id="iq-subject"
          style={field}
          type="text"
          value={fields.subject}
          onChange={(e) => set("subject", e.target.value)}
        />
      </div>

      <div>
        <label style={label} htmlFor="iq-message">
          Message
        </label>
        <textarea
          id="iq-message"
          style={{ ...field, resize: "vertical", minHeight: "120px" }}
          rows={5}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "14px",
          color: "var(--eac-enn-ink-soft, #bcb6aa)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={fields.newsletter}
          onChange={(e) => set("newsletter", e.target.checked)}
        />
        Sign up for news and updates
      </label>

      {status === "error" && (
        <p role="alert" style={{ margin: 0, color: "#e07a7a", fontSize: "15px" }}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        style={{
          justifySelf: "start",
          padding: "13px 34px",
          border: "1px solid var(--eac-enn-line, rgba(255,255,255,0.18))",
          borderRadius: "999px",
          background: "transparent",
          color: "var(--eac-enn-ink, #ece7dd)",
          fontFamily: "var(--eac-enn-body, inherit)",
          fontSize: "13px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: status === "sending" ? "default" : "pointer",
          opacity: status === "sending" ? 0.6 : 1,
        }}
      >
        {status === "sending" ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
