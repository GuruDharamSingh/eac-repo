"use client";

import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import { Reveal } from "./Reveal";

/**
 * "Start Here" — the sign-up column and the copy beside it, as they were.
 * BaroqueSignup is the Mantine-free one from @elkdonis/cms-ui/auth; on
 * success the member lands on the hub, which is where the feed now is.
 */
export function JoinSection() {
  return (
    <section id="join" className="join-section" style={{ background: "var(--eac-bg)", padding: "5rem 1.5rem" }}>
      <Reveal className="section-inner join-grid">
        <div className="join-auth-column">
          <BaroqueSignup
            initialMode="signup"
            title="Start Here"
            subtitle="Let's stay in touch, your account creation here leads to Our Feed where workshops, Meetings and publications will appear."
            onSuccess={({ mode }) => {
              window.location.href = mode === "signup" ? "/hub?welcome=1" : "/hub";
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
      </Reveal>
    </section>
  );
}
