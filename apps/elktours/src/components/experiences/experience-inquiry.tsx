"use client";

import * as React from "react";
import { Button } from "@elkdonis/primitives";
import { sendExperienceInquiryAction } from "@/lib/experience-actions";

/**
 * Ask about an experience. Phase A is inquiry only (no dates, no checkout):
 * this posts to the site's existing /api/inquiry, which accepts any published
 * thread of this org and files a guest submission plus a contact.
 */
export function ExperienceInquiry({ threadId, title, signedInEmail = null, disabled = false }: {
  threadId: string;
  title: string;
  signedInEmail?: string | null;
  /** True on drafts: the API only takes published experiences. */
  disabled?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(signedInEmail ?? "");
  const [message, setMessage] = React.useState("");
  const [partySize, setPartySize] = React.useState("");
  const [preferredDate, setPreferredDate] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const party = partySize === "" ? null : Number(partySize);
    try {
      const r = await sendExperienceInquiryAction({ experienceId: threadId, name, email, message, partySize: party, preferredDate: preferredDate || null });
      if (!r.ok) throw new Error(r.error);
      setStatus("sent");
      setMessage("");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not send.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="text-sm">
        <p className="font-serif text-lg">Thank you.</p>
        <p className="mt-1 text-muted-foreground">We will write back about <em>{title}</em> soon.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setStatus("idle")}>Send another</Button>
      </div>
    );
  }

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="exp-inq-name" className="mb-1 block text-sm font-medium">Your name</label>
        <input id="exp-inq-name" required value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="exp-inq-email" className="mb-1 block text-sm font-medium">Email</label>
        <input id="exp-inq-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exp-inq-date" className="mb-1 block text-sm font-medium">Preferred date</label>
          <input id="exp-inq-date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="exp-inq-party" className="mb-1 block text-sm font-medium">How many</label>
          <input id="exp-inq-party" type="number" min={1} max={50} value={partySize} onChange={(e) => setPartySize(e.target.value)} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="exp-inq-msg" className="mb-1 block text-sm font-medium">
          Message <span className="text-muted-foreground">(dates, group size, questions)</span>
        </label>
        <textarea id="exp-inq-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={input} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={disabled || status === "sending"}>
        {disabled ? "Opens when published" : status === "sending" ? "Sending…" : "Ask about this experience"}
      </Button>
    </form>
  );
}
