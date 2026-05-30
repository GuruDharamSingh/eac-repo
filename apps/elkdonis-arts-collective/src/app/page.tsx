"use client";

import { useState } from "react";
import { StatementThreshold } from "@/components/StatementThreshold";
import SiteNav from "@/components/SiteNav";
import { BoardRow } from "@/components/BoardRow";
import { About } from "@/components/About";
import { CurrentWorkQuestion } from "@/components/CurrentWorkQuestion";
import { ImageSpaceBanner } from "@/components/ImageSpaceBanner";
import { CitiesVision, VisionStatement } from "@/components/CitiesVision";
import { GallerySlider } from "@/components/GallerySlider";
import { FeatureInitiative } from "@/components/FeatureInitiative";
import { FeaturedEventsTable } from "@/components/FeaturedEventsTable";
import { FeaturedGrantProgram } from "@/components/FeaturedGrantProgram";
import { FundraisingGoal } from "@/components/FundraisingGoal";
import { JoinSection } from "@/components/JoinSection";
import { Footer } from "@/components/Footer";
import { StickyJoinBar } from "@elkdonis/ui";

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
            <h1 className="landing-title">Elkdonis Arts Collective</h1>
            <p className="landing-subtitle">Non-Profit Organization</p>
            <hr
              className="gold-rule"
              style={{ "--rule-width": "80px", margin: "2rem auto" } as React.CSSProperties}
            />
          </div>
          <div className="landing-hero-scroll-cue" aria-hidden="true">
            <span />
          </div>
        </header>

        {/* ── Current Work Question (boxed) + manifesto excerpt below ── */}
        <CurrentWorkQuestion />

        {/* ── Banner Image Space (admin-selectable) ── */}
        <ImageSpaceBanner />

        {/* ── Join the Collective ── */}
        <JoinSection />

        {/* ── About ── */}
        <About />

        {/* ── Featured Initiative ── */}
        <FeatureInitiative />

        {/* ── Featured Inner Gathering Events ── */}
        <FeaturedEventsTable />


        {/* ── Featured Arts ── */}
        <FeaturedGrantProgram />

        {/* ── Fundraising Goal ── */}
        <FundraisingGoal />

        {/* ── Gallery ── */}
        <GallerySlider />

        {/* ── Cities + Vision ── */}
        <CitiesVision />

        {/* ── Board of Directors (team — moved to bottom) ── */}
        <BoardRow />

        {/* ── Contact ── */}
        {/* ── Vision statement ── */}
        <VisionStatement />

        {/* ── Footer ── */}
        <Footer />

        {/* Sticky CTA — hides when #join is on screen */}
        <StickyJoinBar />
      </div>
    </>
  );
}
