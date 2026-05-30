"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";

type Status = "idle" | "sending" | "done" | "error";

export function Footer() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
      if (!res.ok) { setErrorMsg(data.error ?? "Something went wrong."); setStatus("error"); }
      else setStatus("done");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setStatus("idle");
    setErrorMsg("");
    setFields({ name: "", email: "", message: "" });
  }

  return (
    <>
      <footer className="site-footer">
        <div
          style={{
            maxWidth: "var(--content-max)",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
            <address style={{ fontStyle: "normal" }}>
              <a href="mailto:info@elkdonis-arts.org" className="footer-email">
                <Mail size={17} aria-hidden="true" />
                info@elkdonis-arts.org
              </a>
            </address>
            <button
              onClick={() => setOpen(true)}
              className="cta-btn"
              style={{ fontSize: "0.75rem", padding: "0.5rem 1.1rem" }}
            >
              Leave a Message
            </button>
          </div>

          <hr className="gold-rule" style={{ "--rule-width": "100px" } as React.CSSProperties} />
        </div>
      </footer>

      {/* Modal */}
      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(5,5,5,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0d0d0d",
              border: "1px solid rgba(198,164,90,0.3)",
              borderRadius: 12,
              padding: "2.5rem",
              width: "100%",
              maxWidth: 520,
              position: "relative",
            }}
          >
            <button
              onClick={close}
              aria-label="Close"
              style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>

            <p className="section-eyebrow" style={{ marginBottom: "0.5rem" }}>Get in Touch</p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "1.75rem", color: "#f3f4f6", margin: "0 0 1.5rem" }}>
              Leave a Message
            </h2>

            {status === "done" ? (
              <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--color-gold)", fontSize: "1.1rem", lineHeight: 1.7 }}>
                Thank you — we&apos;ll be in touch soon.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form" noValidate>
                <div className="form-row">
                  <label className="form-label" htmlFor="modal-name">Name</label>
                  <input id="modal-name" className="form-input" type="text" required autoComplete="name" value={fields.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="modal-email">Email</label>
                  <input id="modal-email" className="form-input" type="email" required autoComplete="email" value={fields.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="modal-message">Message</label>
                  <textarea id="modal-message" className="form-input" rows={5} required value={fields.message} onChange={(e) => set("message", e.target.value)} />
                </div>
                {status === "error" && <p className="form-error" role="alert">{errorMsg}</p>}
                <button type="submit" className="cta-btn" disabled={status === "sending"} style={{ width: "100%", justifyContent: "center" }}>
                  {status === "sending" ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
