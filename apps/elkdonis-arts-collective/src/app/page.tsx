"use client";

import { useState } from "react";
import { StatementThreshold } from "@/components/StatementThreshold";
import SiteNav from "@/components/SiteNav";
import { BoardRow } from "@/components/BoardRow";
import { About } from "@/components/About";
import { FeatureInitiative } from "@/components/FeatureInitiative";
import { FundraisingGoal } from "@/components/FundraisingGoal";
import { Philosophy } from "@/components/Philosophy";
import { ContactForm } from "@/components/ContactForm";
import { ArtistDirectoryCTA } from "@/components/ArtistDirectoryCTA";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  const [thresholdDone, setThresholdDone] = useState(false);

  return (
    <>
      {/* Statement Threshold — covers everything until dismissed */}
      {!thresholdDone && (
        <StatementThreshold onDismiss={() => setThresholdDone(true)} />
      )}

      {/* Main page — rendered underneath; scrolling begins once threshold clears */}
      <div
        style={{
          opacity: thresholdDone ? 1 : 0,
          transition: "opacity 0.8s ease",
          pointerEvents: thresholdDone ? "auto" : "none",
        }}
      >
        <SiteNav />

        {/* ── Hero banner ── */}
        <header className="landing-hero">
          <div className="landing-hero-inner">
            <p className="landing-eyebrow">Est. 2024 · Toronto, Canada</p>
            <h1 className="landing-title">Elkdonis Arts Collective</h1>
            <p className="landing-subtitle">Non-Profit Organization</p>
            <hr
              className="gold-rule"
              style={{ "--rule-width": "80px", margin: "2rem auto" } as React.CSSProperties}
            />
            <p className="landing-tagline">
              A Fourth-Way Mutual Aid Society — restoring the necessity of art in life for all.
            </p>
          </div>
          <div className="landing-hero-scroll-cue" aria-hidden="true">
            <span />
          </div>
        </header>

        {/* ── Board of Directors ── */}
        <BoardRow />

        {/* ── About ── */}
        <About />

        {/* ── Featured Initiative ── */}
        <FeatureInitiative />

        {/* ── Fundraising Goal ── */}
        <FundraisingGoal />

        {/* ── Philosophy ── */}
        <Philosophy />

        {/* ── Contact ── */}
        <ContactForm />

        {/* ── Artist Directory CTA ── */}
        <ArtistDirectoryCTA />

        {/* ── Footer ── */}
        <Footer />
      </div>
    </>
  );
}

