"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function ContactForm() {
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
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
          <p className="section-eyebrow">Stay in Touch</p>
          <h2 className="section-heading">Leave a Message</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />
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
