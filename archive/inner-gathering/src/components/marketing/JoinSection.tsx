"use client";

import { useEffect, useRef, useState } from "react";
import { BaroqueSignup } from "@elkdonis/ui";

export function JoinSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="join"
      ref={ref}
      className="join-section"
      style={{ background: "var(--eac-bg)", padding: "5rem 1.5rem" }}
    >
      <div
        className={`section-inner join-grid reveal ${visible ? "in-view" : ""}`}
      >
        <div className="join-auth-column">
          <BaroqueSignup
            initialMode="signup"
            title="Start Here"
            subtitle="Let's stay in touch, your account creation here leads to Our Feed where workshops, Meetings and publications will appear."
            onSuccess={({ mode }) => {
              if (mode === "signup") {
                window.location.href = "/feed?welcome=1";
              } else {
                window.location.href = "/feed";
              }
            }}
          />
        </div>

        <aside className="join-copy-column" aria-label="Why join">
          <p className="join-copy-eyebrow">Inside The Collective</p>
          <h3 className="join-copy-title">A shared space for artists, organizers, and patrons.</h3>
          <p className="join-copy-body">
            Your member account opens the inner gathering feed, where projects are posted,
            collaborations begin, and collective updates stay connected in one stream.
          </p>
          <ul className="join-copy-list" aria-label="Member benefits">
            <li>Access private gathering updates and announcements</li>
            <li>Publish and refine your artist presence over time</li>
            <li>Participate in calls, workshops, and collective dialogue</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
