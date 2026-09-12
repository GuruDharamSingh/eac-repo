"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface InquiryFormProps {
  threadId: string;
  serviceTitle: string;
}

export function InquiryForm({ threadId, serviceTitle }: InquiryFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, name, email, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="card-natural p-6 text-center">
        <p className="font-serif text-lg">Thank you for your inquiry.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We&rsquo;ll be in touch about <em>{serviceTitle}</em>.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setStatus("idle")}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-natural space-y-4 p-6">
      <h3 className="font-serif text-lg">Inquire about this service</h3>

      <div>
        <label htmlFor="inq-name" className="mb-1 block text-sm font-medium">
          Your name
        </label>
        <input
          id="inq-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="inq-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="inq-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="inq-msg" className="mb-1 block text-sm font-medium">
          Message <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="inq-msg"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-destructive">
          Something went wrong. Please try again.
        </p>
      )}

      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send inquiry"}
      </Button>
    </form>
  );
}
