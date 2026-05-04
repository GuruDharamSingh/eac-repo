"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function ContactForm() {
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  function set(key: keyof typeof fields, val: string) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
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

  return (
    <section id="contact" ref={ref} className="contact-section">
      <div className="section-inner" style={{ maxWidth: "680px" }}>
        <div className={`reveal ${visible ? "in-view" : ""}`} style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p className="section-eyebrow">Get In Touch</p>
          <h2 className="section-heading">Contact Us</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />
          <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.7 }}>
            Interested in joining, collaborating, or supporting our work? We read every message.
          </p>
        </div>

        {status === "done" ? (
          <div className={`reveal in-view contact-success`}>
            <p>Thank you — we&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`reveal ${visible ? "in-view" : ""} contact-form`}
            style={{ transitionDelay: "0.1s" }}
            noValidate
          >
            <div className="form-row">
              <label className="form-label" htmlFor="cf-name">Name</label>
              <input
                id="cf-name"
                className="form-input"
                type="text"
                required
                autoComplete="name"
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="cf-email">Email</label>
              <input
                id="cf-email"
                className="form-input"
                type="email"
                required
                autoComplete="email"
                value={fields.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="cf-subject">Subject</label>
              <select
                id="cf-subject"
                className="form-input"
                value={fields.subject}
                onChange={(e) => set("subject", e.target.value)}
              >
                <option value="">Select a topic…</option>
                <option value="general">General Inquiry</option>
                <option value="membership">Membership</option>
                <option value="workshop">Workshop / Lab</option>
                <option value="donation">Donation / Support</option>
                <option value="artist-directory">Artist Directory Listing</option>
                <option value="press">Press & Media</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="cf-message">Message</label>
              <textarea
                id="cf-message"
                className="form-input"
                rows={5}
                required
                value={fields.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>

            {status === "error" && (
              <p className="form-error" role="alert">{errorMsg}</p>
            )}

            <button
              type="submit"
              className="cta-btn"
              disabled={status === "sending"}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {status === "sending" ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
