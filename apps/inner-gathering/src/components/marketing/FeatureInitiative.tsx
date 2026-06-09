"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface InitiativeConfig {
  eyebrow?: string;
  heading?: string;
  body?: string;
  cta?: string;
}

export function FeatureInitiative() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<InitiativeConfig>({});
  const [checking, setChecking] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/admin/site-config?key=initiative')
      .then((r) => r.json())
      .then((d) => { if (d.value) setCfg(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  function handlePortal() {
    router.push('/feed');
  }

  const eyebrow = cfg.eyebrow ?? "Current Offerings - Spring 2026";
  const heading = cfg.heading ?? "Web Portal";
  const body = cfg.body ?? "Excited to share our site with you that is now being soft launched as Inquiry in to What Is Art For, and facilitated on our web portal. This is an example of what's to come as an offering to anyone wishing to have something similar for their groups!";
  const cta = cfg.cta ?? "Make an Inquiry";

  return (
    <section id="initiative" ref={ref} className="initiative-section">
      <div className="section-inner">
        <div
          className={`reveal ${visible ? "in-view" : ""}`}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}
        >
          <div className="initiative-copy">
            <p className="section-eyebrow">{eyebrow}</p>
            <h2 className="section-heading" style={{ fontFamily: '"Brothers", var(--font-brothers), sans-serif' }}>{heading}</h2>
            <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
            <div style={{ fontFamily: '"Basteleur", serif', color: "#9ca3af", lineHeight: 1.8, marginBottom: "1.25rem" }}>
              {body.split(/\n+/).map((para, i) => (
                <p key={i} style={{ margin: "0 0 0.75em" }}>{para}</p>
              ))}
            </div>
            <div className="initiative-actions" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
              <a href="#contact" className="cta-btn" style={{ display: "inline-flex" }}>
                {cta}
              </a>
              <button
                type="button"
                onClick={handlePortal}
                disabled={checking}
                className="cta-btn"
                style={{ display: "inline-flex", cursor: "pointer" }}
              >
                {checking ? "Checking…" : "Web Portal"}
              </button>
            </div>
          </div>

          <div className="initiative-panel" aria-hidden="true">
            <div className="initiative-panel-inner">
              <div className="initiative-diamond" />
              <p className="initiative-stat">Open-Source</p>
              <p className="initiative-stat-label">Backend</p>
              <div className="initiative-divider" />
              <p className="initiative-stat">Mutual Aid</p>
              <p className="initiative-stat-label">Fund</p>
              <div className="initiative-divider" />
              <p className="initiative-stat">Artists'</p>
              <p className="initiative-stat-label">Online Directory</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
