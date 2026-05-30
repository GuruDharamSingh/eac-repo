"use client";

import { useEffect, useRef, useState } from "react";

interface InitiativeConfig {
  eyebrow?: string;
  heading?: string;
  body?: string;
  cta?: string;
}

export function FeatureInitiative() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<InitiativeConfig>({});
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

  const eyebrow = cfg.eyebrow ?? "Current Offerings - Spring 2026";
  const heading = cfg.heading ?? "Residency, Studios, Galleries";
  const body = cfg.body ?? "The collective has just purchased some beautiful secluded land close to conservation areas, and we are very excited to be developing from the ground up, a permaculture design principles aligned compound. The compound will feature permaculture food forest, artist residences, studios, and galleries. Horseback riding and hiking trails are nearby.";
  const cta = cfg.cta ?? "Make an Inquiry";

  return (
    <section id="initiative" ref={ref} className="initiative-section">
      <div className="section-inner">
        <div
          className={`reveal ${visible ? "in-view" : ""}`}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}
        >
          <div>
            <p className="section-eyebrow">{eyebrow}</p>
            <h2 className="section-heading">{heading}</h2>
            <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
            <div style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8, marginBottom: "1.25rem" }}>
              {body.split(/\n+/).map((para, i) => (
                <p key={i} style={{ margin: "0 0 0.75em" }}>{para}</p>
              ))}
            </div>
            <a href="#contact" className="cta-btn" style={{ marginTop: "2rem", display: "inline-flex" }}>
              {cta}
            </a>
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
