"use client";

import { useState } from "react";

export function SignupForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setStatus(data.error || "Sign up failed. Please try again.");
      return;
    }
    form.reset();
    setStatus("You are on the IFAC list. Thank you.");
  }

  return (
    <form className="form-shell" onSubmit={submit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="signup-name">Name</label>
          <input id="signup-name" name="name" required placeholder="Collector, artist or dealer name" />
        </div>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" name="email" type="email" required placeholder="you@example.com" />
        </div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="signup-role">Interest</label>
          <select id="signup-role" name="interest" defaultValue="collector">
            <option value="collector">Collector</option>
            <option value="artist">Artist</option>
            <option value="dealer">Art dealer</option>
            <option value="press">Press or partner</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="signup-region">Region</label>
          <input id="signup-region" name="region" placeholder="City, country or online" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="signup-message">Message</label>
        <textarea id="signup-message" name="message" placeholder="Tell IFAC what you are looking for." />
      </div>
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Submitting" : "Join IFAC list"}
      </button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
