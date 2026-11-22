"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, X, Instagram, Heart, BookOpen } from "lucide-react";
import { siteConfig } from "@/config/site";

type Status = "idle" | "sending" | "done" | "error";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/Elkdonisarts", Icon: Instagram },
  { label: "GoFundMe", href: "https://www.gofundme.com/f/empowering-artists-in-toronto-and-la", Icon: Heart },
  { label: "Substack", href: "https://elkdonisarts.substack.com/", Icon: BookOpen },
];

/**
 * The collective's footer, on every page: the social row, the email, and
 * "Leave a Message" — the same contact form the old landing carried, posting
 * to /api/contact. Navy with the gold rule, matching the header.
 */
export function SiteFooter() {
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
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
      } else setStatus("done");
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

  const input: React.CSSProperties = {
    width: "100%", padding: "0.7rem 0.9rem", border: "1px solid var(--ig-a-b79a55-45)", borderRadius: 4,
    background: "var(--ig-c-paper)", color: "var(--ig-c-navy-deep)", fontFamily: 'var(--ig-font-text)', fontSize: "1rem",
  };

  return (
    <>
      <footer className="bg-header-footer mt-16 border-t-[3px] border-[color:var(--ig-c-gold)]" data-chrome="footer">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-12 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                data-part="social"
                className="inline-flex flex-col items-center gap-1 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-[color:var(--ig-c-gold-light)] opacity-90 hover:opacity-100"
                style={{ fontFamily: 'var(--site-font-heading)' }}
              >
                <Icon size={20} strokeWidth={1.6} />
                {label}
              </a>
            ))}
            <span className="h-7 w-px bg-[color:var(--ig-a-b79a55-4)]" aria-hidden />
            <address className="not-italic">
              <a href="mailto:info@elkdonis-arts.org" data-part="contact" className="inline-flex items-center gap-2 text-sm text-[color:var(--ig-a-fffdf8-85)] hover:text-[color:var(--ig-c-gold-light)]">
                <Mail size={16} aria-hidden />
                info@elkdonis-arts.org
              </a>
            </address>
            <button type="button" onClick={() => setOpen(true)} data-part="cta" className="cta-btn" style={{ fontSize: "0.72rem", padding: "0.45rem 1rem" }}>
              Leave a Message
            </button>
          </div>

          <hr className="gold-rule" style={{ "--rule-width": "80px", margin: 0 } as React.CSSProperties} />

          <p data-part="legal" className="text-xs text-[color:var(--ig-a-fffdf8-6)]" style={{ fontFamily: 'var(--site-font-heading)', letterSpacing: "0.12em" }}>
            © {new Date().getFullYear()} {siteConfig.orgName} · Toronto · Los Angeles · Paris ·{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-[color:var(--ig-c-gold-light)]">Member sign in</Link>{" "}·{" "}
            <Link href="/data" className="underline underline-offset-2 hover:text-[color:var(--ig-c-gold-light)]">Your data</Link>
          </p>
        </div>
      </footer>

      {open && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--ig-a-01124e-82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Leave a message"
            style={{ width: "min(520px, 100%)", background: "var(--ig-c-parchment)", border: "1px solid var(--ig-a-b79a55-55)", borderRadius: 6, padding: "1.5rem", boxShadow: "0 24px 60px var(--ig-a-000000-4)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--site-font-heading)', fontSize: "1.3rem", color: "var(--ig-c-navy-deep)" }}>Leave a Message</h3>
              <button type="button" onClick={close} aria-label="Close" style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ig-c-navy-deep)" }}>
                <X size={20} />
              </button>
            </div>
            {status === "done" ? (
              <p style={{ margin: 0, color: "var(--ig-c-navy-deep)", fontFamily: 'var(--ig-font-text)' }}>Thank you — we&rsquo;ll be in touch.</p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
                <input style={input} placeholder="Your name" value={fields.name} onChange={(e) => set("name", e.target.value)} />
                <input style={input} type="email" required placeholder="Your email" value={fields.email} onChange={(e) => set("email", e.target.value)} />
                <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} placeholder="Your message" value={fields.message} onChange={(e) => set("message", e.target.value)} />
                {errorMsg && <p style={{ margin: 0, color: "var(--ig-c-red-dark)", fontSize: "0.9rem" }}>{errorMsg}</p>}
                <button type="submit" className="cta-btn" disabled={status === "sending"} style={{ justifySelf: "end", cursor: "pointer" }}>
                  {status === "sending" ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
