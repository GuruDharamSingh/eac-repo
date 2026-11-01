"use client";

import { useState, type FormEvent } from "react";

/**
 * Asks for an email address and an optional note, posts to the site's
 * /api/data/delete, and shows the confirmation code with a link to the status
 * page. No sign-in is required: the person asking may no longer have access.
 */
export function DeletionRequestForm({
  endpoint = "/api/data/delete",
  statusHref = "/data/delete",
}: {
  endpoint?: string;
  statusHref?: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; confirmationCode?: string };
      if (!res.ok || !data.confirmationCode) {
        setError(data.error ?? "Something went wrong. Email us instead.");
        setState("error");
        return;
      }
      setCode(data.confirmationCode);
      setState("done");
    } catch {
      setError("Network error. Email us instead.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="eac-policy-form eac-policy-form-done" role="status">
        <p>
          Your request is recorded. Your confirmation code is <code>{code}</code>. Keep it: it is the
          only way to look the request up, and we will quote it when we reply.
        </p>
        <p>
          <a href={`${statusHref}?code=${encodeURIComponent(code)}`}>Follow the request</a>
        </p>
      </div>
    );
  }

  return (
    <form className="eac-policy-form" onSubmit={submit}>
      <label>
        <span>The email address on the account</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        <span>Anything we should know (optional)</span>
        <textarea
          name="message"
          rows={4}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Which sites or groups, whether you want a copy of your files first, another address we might know you by…"
        />
      </label>
      {error && <p className="eac-policy-error">{error}</p>}
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Ask us to delete my data"}
      </button>
    </form>
  );
}
