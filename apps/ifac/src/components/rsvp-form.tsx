"use client";

import { useState } from "react";
import type { PublicEvent } from "@/lib/types";

export function RsvpForm({ events }: { events: PublicEvent[] }) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setStatus(data.error || "RSVP failed. Please try again.");
      return;
    }
    form.reset();
    setStatus("RSVP received. IFAC has your details.");
  }

  return (
    <form className="form-shell" onSubmit={submit}>
      <div className="field">
        <label htmlFor="event-id">Event</label>
        <select id="event-id" name="event_id" defaultValue={events[0]?.id ?? ""}>
          {events.map((event) => (
            <option key={event.id} value={event.id.startsWith("ifac-preview") ? "" : event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="rsvp-name">Name</label>
          <input id="rsvp-name" name="name" required placeholder="Full name" />
        </div>
        <div className="field">
          <label htmlFor="rsvp-email">Email</label>
          <input id="rsvp-email" name="email" type="email" required placeholder="you@example.com" />
        </div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="rsvp-phone">Phone</label>
          <input id="rsvp-phone" name="phone" placeholder="Optional" />
        </div>
        <div className="field">
          <label htmlFor="rsvp-status">Status</label>
          <select id="rsvp-status" name="status" defaultValue="yes">
            <option value="yes">Attending</option>
            <option value="maybe">Interested</option>
            <option value="no">Cannot attend</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="rsvp-message">Message</label>
        <textarea id="rsvp-message" name="message" placeholder="Access needs, guests, collector interests or questions." />
      </div>
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Sending" : "Send RSVP"}
      </button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
