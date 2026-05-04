"use client";

import { useEffect, useRef, useState } from "react";

export function FeatureInitiative() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="initiative" ref={ref} className="initiative-section">
      <div className="section-inner">
        <div
          className={`reveal ${visible ? "in-view" : ""}`}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}
        >
          {/* Text */}
          <div>
            <p className="section-eyebrow">Featured Initiative</p>
            <h2 className="section-heading">Paratheatre Lab Series</h2>
            <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
            <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8, marginBottom: "1.25rem" }}>
              A six-session structured laboratory in Paratheatre — the practice of using theatre
              as a form of inner work. Participants are guided through attention exercises,
              movement rituals, and sound-based group presence work drawn from the Fourth Way
              tradition and Grotowski's Theatre of Sources.
            </p>
            <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8 }}>
              Open to artists, seekers, and anyone who has felt the gap between their
              ordinary life and the quality of experience they know is possible.
              No prior theatre experience required — presence is the only prerequisite.
            </p>
            <a href="#contact" className="cta-btn" style={{ marginTop: "2rem", display: "inline-flex" }}>
              Register Interest
            </a>
          </div>

          {/* Decorative panel */}
          <div className="initiative-panel" aria-hidden="true">
            <div className="initiative-panel-inner">
              <div className="initiative-diamond" />
              <p className="initiative-stat">6</p>
              <p className="initiative-stat-label">Sessions</p>
              <div className="initiative-divider" />
              <p className="initiative-stat">12</p>
              <p className="initiative-stat-label">Participants Max</p>
              <div className="initiative-divider" />
              <p className="initiative-stat">Sliding</p>
              <p className="initiative-stat-label">Scale Fee</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
