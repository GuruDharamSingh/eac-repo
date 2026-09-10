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
    width: "100%", padding: "0.7rem 0.9rem", border: "1px solid rgba(183,154,85,0.45)", borderRadius: 4,
    background: "#fffdf8", color: "#01124E", fontFamily: '"Basteleur", Georgia, serif', fontSize: "1rem",
  };

  return (
    <>
      <footer className="bg-header-footer mt-16 border-t-[3px] border-[#b79a55]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-12 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex flex-col items-center gap-1 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-[#d6c38e] opacity-90 hover:opacity-100"
                style={{ fontFamily: '"Venture", Georgia, serif' }}
              >
                <Icon size={20} strokeWidth={1.6} />
                {label}
              </a>
            ))}
            <span className="h-7 w-px bg-[#b79a55]/40" aria-hidden />
            <address className="not-italic">
              <a href="mailto:info@elkdonis-arts.org" className="inline-flex items-center gap-2 text-sm text-[#fffdf8]/85 hover:text-[#d6c38e]">
                <Mail size={16} aria-hidden />
                info@elkdonis-arts.org
              </a>
            </address>
            <button type="button" onClick={() => setOpen(true)} className="cta-btn" style={{ fontSize: "0.72rem", padding: "0.45rem 1rem" }}>
              Leave a Message
            </button>
          </div>

          <hr className="gold-rule" style={{ "--rule-width": "80px", margin: 0 } as React.CSSProperties} />

          <p className="text-xs text-[#fffdf8]/60" style={{ fontFamily: '"Venture", Georgia, serif', letterSpacing: "0.12em" }}>
            © {new Date().getFullYear()} {siteConfig.orgName} · Elkdonis Arts Collective · Toronto · Los Angeles · Paris ·{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-[#d6c38e]">Member sign in</Link>
          </p>
        </div>
      </footer>

      {open && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(1,18,78,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Leave a message"
            style={{ width: "min(520px, 100%)", background: "#fbf7ef", border: "1px solid rgba(183,154,85,0.55)", borderRadius: 6, padding: "1.5rem", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontFamily: '"Venture", Georgia, serif', fontSize: "1.3rem", color: "#01124E" }}>Leave a Message</h3>
              <button type="button" onClick={close} aria-label="Close" style={{ background: "none", border: 0, cursor: "pointer", color: "#01124E" }}>
                <X size={20} />
              </button>
            </div>
            {status === "done" ? (
              <p style={{ margin: 0, color: "#01124E", fontFamily: '"Basteleur", Georgia, serif' }}>Thank you — we&rsquo;ll be in touch.</p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
                <input style={input} placeholder="Your name" value={fields.name} onChange={(e) => set("name", e.target.value)} />
                <input style={input} type="email" required placeholder="Your email" value={fields.email} onChange={(e) => set("email", e.target.value)} />
                <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} placeholder="Your message" value={fields.message} onChange={(e) => set("message", e.target.value)} />
                {errorMsg && <p style={{ margin: 0, color: "#8b2e2e", fontSize: "0.9rem" }}>{errorMsg}</p>}
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
