"use client";

import { BoardRow } from "@/components/marketing/BoardRow";
import { About } from "@/components/marketing/About";
import { WorkQuestionBox } from "@/components/work-question-box";
import { WorkQuestionLoginBar } from "@/components/marketing/WorkQuestionLoginBar";
import { ImageSpaceBanner } from "@/components/marketing/ImageSpaceBanner";
import { CitiesVision, VisionStatement } from "@/components/marketing/CitiesVision";
import { GallerySlider } from "@/components/marketing/GallerySlider";
import { FeatureInitiative } from "@/components/marketing/FeatureInitiative";
import { FeaturedEventsTable } from "@/components/marketing/FeaturedEventsTable";
import { FeaturedGrantProgram } from "@/components/marketing/FeaturedGrantProgram";
import { FundraisingGoal } from "@/components/marketing/FundraisingGoal";
import { JoinSection } from "@/components/marketing/JoinSection";
import { Footer } from "@/components/marketing/Footer";
import { MarketingStickyBar } from "@/components/marketing/MarketingStickyBar";

export default function LandingPage() {
  return (
    <>
      {/* Main page */}
      <div>
        {/* ── Hero banner ── */}
        <header className="landing-hero">
          <div className="landing-hero-inner">
            <h1 className="landing-title">
              Elkdonis Arts<br />Collective
            </h1>
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

        {/* ── Current Work Question ── */}
        <section className="cwq-section">
          <div className="section-inner" style={{ maxWidth: 1100 }}>
            <p className="section-eyebrow">Current Work Question</p>
            <div style={{ minWidth: 0, marginTop: "1.25rem" }}>
              <WorkQuestionBox hideEyebrow hideTicker hideAnonymousNote showForumLink />
            </div>

            <WorkQuestionLoginBar />

            {/* TODO: finish attribution + credit before showing */}
            {false && (
            <aside className="cwq-excerpt">
              <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                <blockquote
                  style={{
                    fontFamily: '"Basteleur", serif',
                    fontSize: "clamp(1rem, 1.4vw, 1.1rem)",
                    lineHeight: 1.85,
                    color: "var(--eac-ink, #01124E)",
                    margin: 0,
                    borderLeft: "3px solid var(--eac-gold, #b79a55)",
                    paddingLeft: "1.25rem",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;The artist endeavours to penetrate experience in order to know the self
                  and the world. It is a difficult and never ending process to find ways of
                  using a medium to interpret something seen and experienced into a form which
                  can be received and seen by another. To persevere in this process despite
                  frustration and failure requires commitment and work, driven in large part
                  by human necessity.&rdquo;
                </blockquote>
                <figcaption
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    paddingLeft: "1.25rem",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--eac-gold, #b79a55)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0, opacity: 0.8 }}
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      letterSpacing: "0.08em",
                      color: "var(--eac-muted, #6b7280)",
                      textTransform: "uppercase",
                    }}
                  >
                    — Attribution TBD
                  </span>
                </figcaption>
              </figure>
            </aside>
            )}
          </div>
        </section>

        {/* ── About / Mutual Aid (above initiative) ── */}
        <About />

        {/* ── Banner Image Space (admin-selectable) ── */}
        <ImageSpaceBanner />

        {/* ── Featured Initiative (below banner) ── */}
        <FeatureInitiative />

        {/* ── Featured Inner Gathering Events ── */}
        <FeaturedEventsTable />

        {/* ── Featured Arts ── */}
        <FeaturedGrantProgram />

        {/* ── Gallery (below Featured Artist) ── */}
        <GallerySlider />

        {/* ── Join the Collective ── */}
        <JoinSection />

        {/* ── Fundraising Goal / Community Support ── */}
        <FundraisingGoal />

        {/* ── Cities ── */}
        <CitiesVision />

        {/* ── Board ── */}
        <BoardRow />

        {/* ── Vision Statement ── */}
        <VisionStatement />

        {/* ── Footer ── */}
        <Footer />

        {/* Sticky CTA — hides when #join is on screen */}
        <MarketingStickyBar />
      </div>
    </>
  );
}
