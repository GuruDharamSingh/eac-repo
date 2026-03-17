import { ExternalLink } from "lucide-react";

export function Hero() {
  return (
    <section className="hero-section">
      {/* Sacred geometry */}
      <div
        className="sacred-geometry animate-float"
        style={{ width: "600px", height: "600px", top: "-200px", right: "-200px" }}
      />
      <div
        className="sacred-geometry animate-float delay-300"
        style={{ width: "400px", height: "400px", bottom: "-100px", left: "-100px" }}
      />
      <div
        className="sacred-geometry animate-float delay-500"
        style={{ width: "300px", height: "300px", top: "50%", right: "10%" }}
      />

      <div className="hero-content">
        {/* Title */}
        <h1 className="hero-title opacity-0 animate-fade-in-up">
          Elkdonis Arts Collective
        </h1>

        {/* Gold rule */}
        <hr className="gold-rule opacity-0 animate-fade-in delay-200" />

        {/* Quote */}
        <blockquote className="hero-quote opacity-0 animate-fade-in-up delay-300">
          <p>
            Real attention is a radiant field of energy…a timeless medium for
            the instantaneous transfer of experience. It is a function or
            property of space in which we can participate voluntarily, or not.
            It is the congruence of perception and will which, when
            voluntarized, connects us to our experience. It is the catalyst
            which transforms sensation into consciousness. It is the necessary
            and sufficient condition of our possible evolution.
          </p>
          <cite>— inpresence.org</cite>
        </blockquote>

        {/* CTA */}
        <div className="opacity-0 animate-fade-in-up delay-500">
          <a
            href="https://inpresence.org"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
          >
            Free Courses &amp; Study Groups
            <ExternalLink size={17} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#about"
        className="scroll-indicator opacity-0 animate-fade-in delay-700"
        aria-label="Scroll to About section"
      >
        <span>Discover</span>
        <div className="scroll-mouse" aria-hidden="true">
          <div className="scroll-dot" />
        </div>
      </a>
    </section>
  );
}
