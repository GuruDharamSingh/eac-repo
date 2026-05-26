"use client";

import { useEffect, useRef, useState } from "react";

interface FundraisingConfig {
  goal?: number;
  raised?: number;
  status?: string;
  url?: string;
  cta?: string;
}

export function FundraisingGoal() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<FundraisingConfig>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/admin/site-config?key=fundraising')
      .then((r) => r.json())
      .then((d) => { if (d.value) setCfg(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const goal = cfg.goal ?? 25000;
  const raised = cfg.raised ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const url = cfg.url ?? "https://linktr.ee/elkdonisarts";
  const cta = cfg.cta ?? "Support Our Work";

  return (
    <section id="fundraising" ref={ref} className="fundraising-section">
      <div className="section-inner" style={{ maxWidth: "720px" }}>
        <div
          className={`reveal ${visible ? "in-view" : ""}`}
          style={{ textAlign: "center" }}
        >
          <p className="section-eyebrow">Community Support</p>
          <h2 className="section-heading">Fundraising Goal</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />

          {cfg.status ? (
            <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8, marginBottom: "2rem" }}>
              {cfg.status}
            </p>
          ) : (
            <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8, marginBottom: "2rem" }}>
              Take a look at our current Fundraiser &amp; follow us to be informed when we
              launch our first events.
            </p>
          )}

          {raised > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
                <span>CAD ${raised.toLocaleString()} raised</span>
                <span>Goal: ${goal.toLocaleString()} ({pct}%)</span>
              </div>
              <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #c9a962, #f0db9d)", borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            </div>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
            style={{ marginTop: "1rem", display: "inline-flex" }}
          >
            {cta}
          </a>
        </div>
      </div>
    </section>
  );
}
