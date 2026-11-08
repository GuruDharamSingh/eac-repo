"use client";

import { useState, type FormEvent } from "react";
import { siteConfig } from "@/config/site";

/**
 * The he-contact block's form (round 3). Posts to this site's existing
 * `/api/org/<org>/contact` (handleOrgContact: a contacts row and a note to
 * the owner), as the Silex contact page did. Every word comes from the
 * block's props.
 */
export function ContactForm({
  nameLabel,
  emailLabel,
  messageLabel,
  buttonLabel,
  thanks,
}: {
  nameLabel: string;
  emailLabel: string;
  messageLabel: string;
  buttonLabel: string;
  thanks: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // A person never sees or fills this; a bot that fills every field does.
    if (String(data.get("company") ?? "")) return setState("sent");
    setState("sending");
    setError(null);
    try {
      const res = await fetch(`/api/org/${siteConfig.orgSlug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), message: data.get("message") }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "That did not send. Please try again.");
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send. Please try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="he-contact-thanks">
        {thanks}
      </p>
    );
  }
  return (
    <form className="he-contact-form" onSubmit={onSubmit}>
      <label>
        <span>{nameLabel}</span>
        <input name="name" className="he-input" autoComplete="name" maxLength={200} />
      </label>
      <label>
        <span>{emailLabel}</span>
        <input name="email" type="email" className="he-input" autoComplete="email" required maxLength={320} />
      </label>
      <label className="he-contact-wide">
        <span>{messageLabel}</span>
        <textarea name="message" className="he-input" rows={5} required maxLength={4000} />
      </label>
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="he-contact-pot" />
      {error ? (
        <p role="alert" className="he-when-error he-contact-wide">
          {error}
        </p>
      ) : null}
      <button type="submit" className="he-btn he-primary" disabled={state === "sending"}>
        {state === "sending" ? "…" : buttonLabel}
      </button>
    </form>
  );
}
