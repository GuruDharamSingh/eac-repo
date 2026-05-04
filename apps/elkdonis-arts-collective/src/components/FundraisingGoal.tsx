"use client";

import { useEffect, useRef, useState } from "react";

const GOAL = 12000;
const RAISED = 3800;
const PCT = Math.round((RAISED / GOAL) * 100);

export function FundraisingGoal() {
  const [visible, setVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          // Animate bar after a brief delay
          setTimeout(() => setBarWidth(PCT), 300);
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

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

          <p style={{ fontFamily: "var(--font-sans)", color: "#9ca3af", lineHeight: 1.8, marginBottom: "2.5rem" }}>
            We are raising funds to establish a dedicated physical space for workshops,
            exhibitions, and community gatherings in the Greater Toronto Area.
            Every contribution directly supports accessible programming on a sliding-scale fee model.
          </p>

          {/* Progress bar */}
          <div className="fundraising-progress-wrap" aria-label={`${PCT}% of fundraising goal reached`}>
            <div
              className="fundraising-bar"
              style={{ width: `${barWidth}%` }}
              role="progressbar"
              aria-valuenow={RAISED}
              aria-valuemin={0}
              aria-valuemax={GOAL}
            />
          </div>

          {/* Stats */}
          <div className="fundraising-stats">
            <div className="fundraising-stat">
              <span className="fundraising-amount">${RAISED.toLocaleString()}</span>
              <span className="fundraising-label">Raised</span>
            </div>
            <div className="fundraising-stat" style={{ textAlign: "center" }}>
              <span className="fundraising-amount">{PCT}%</span>
              <span className="fundraising-label">of Goal</span>
            </div>
            <div className="fundraising-stat" style={{ textAlign: "right" }}>
              <span className="fundraising-amount">${GOAL.toLocaleString()}</span>
              <span className="fundraising-label">Goal</span>
            </div>
          </div>

          <a href="#contact" className="cta-btn" style={{ marginTop: "2.5rem", display: "inline-flex" }}>
            Support Our Work
          </a>
        </div>
      </div>
    </section>
  );
}
