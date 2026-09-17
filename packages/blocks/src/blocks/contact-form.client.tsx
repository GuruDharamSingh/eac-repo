"use client";

import { useState } from "react";
import type { ContactFormProps } from "./contact-form";

// ============================================================================
// The interactive half of the contact form.
//
// Split from its declaration for a reason that is not stylistic. A module
// marked "use client" has its exports turned into CLIENT REFERENCES, so a
// server module that imports the block and reads `block.def.props` gets
// `undefined` — which is exactly what happened: putting "use client" at the
// top of the whole block file made `createCatalogue` throw at module
// evaluation and took every page that imports @elkdonis/blocks with it.
//
// A component can cross that boundary. A plain data object cannot. So the
// declaration stays server-safe and only this crosses.
// ============================================================================

type State = "idle" | "sending" | "sent" | "error";

export function ContactFormView({
  heading = "Get in touch",
  intro,
  topics,
  submitLabel = "Send",
  success = "Thank you — your message has been sent.",
  note,
}: ContactFormProps) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const subjects = (topics ?? []).map((t) => String(t).trim()).filter(Boolean);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);

    const data = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
          // The honeypot. A person never sees this field and never fills it;
          // a bot that fills every input does. Named plausibly on purpose —
          // "honeypot" in the markup is a hint to whoever is reading it.
          company: data.get("company"),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "That did not send.");
      }
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "That did not send.");
    }
  }

  if (state === "sent") {
    return (
      <div className="blk blk-contact" data-state="sent">
        {/* Announced, not just shown: someone using a screen reader has no
            other way to know the page changed under them. */}
        <p className="blk-contact-sent" role="status">
          {success}
        </p>
      </div>
    );
  }

  return (
    <div className="blk blk-contact">
      {heading ? <h2 className="blk-contact-heading">{heading}</h2> : null}
      {intro ? <p className="blk-contact-intro">{intro}</p> : null}

      <form className="blk-contact-form" onSubmit={submit} noValidate={false}>
        <label className="blk-contact-field">
          <span className="blk-contact-label">Your name</span>
          <input className="blk-contact-input" name="name" type="text" required maxLength={120} autoComplete="name" />
        </label>

        <label className="blk-contact-field">
          <span className="blk-contact-label">Your email</span>
          <input className="blk-contact-input" name="email" type="email" required maxLength={200} autoComplete="email" />
        </label>

        {subjects.length > 0 ? (
          <label className="blk-contact-field">
            <span className="blk-contact-label">About</span>
            <select className="blk-contact-input" name="subject" defaultValue={subjects[0]}>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="blk-contact-field">
          <span className="blk-contact-label">Message</span>
          <textarea className="blk-contact-input" name="message" rows={6} required maxLength={4000} />
        </label>

        {/* Off-screen rather than display:none — a bot reading the DOM sees a
            normal text input either way, and a hidden input is a known tell. */}
        <div className="blk-sr" aria-hidden>
          <label>
            Company
            <input name="company" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="blk-contact-actions">
          <button className="blk-contact-send" type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : submitLabel}
          </button>
          {note ? <span className="blk-contact-note">{note}</span> : null}
        </div>

        {state === "error" ? (
          <p className="blk-contact-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

