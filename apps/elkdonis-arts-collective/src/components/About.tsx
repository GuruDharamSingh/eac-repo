"use client";

import { useEffect, useRef, useState } from "react";

export function About() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" ref={sectionRef} className="about-section">
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Section header */}
        <div
          className={`reveal ${isVisible ? "in-view" : ""}`}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <h2 className="section-heading">A Mutual Aid Society</h2>
          <hr
            className="gold-rule"
            style={{ "--rule-width": "60px" } as React.CSSProperties}
          />
        </div>

        <div
          className={`reveal ${isVisible ? "in-view" : ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
            gap: "4rem",
            transitionDelay: "0.1s",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="about-lead">
              Elkdonis Arts is a community organization dedicated to promoting and
              practicing objective arts, several forms of education, and cultural
              exchange for public benefit.
            </p>
            <p className="about-lead">
              We provide accessible educational programs, workshops, lectures, and
              learning opportunities across diverse disciplines, including visual
              arts, theatre, philosophy, literature and cultural studies. We support
              artists, educators, thinkers, and creatives by offering opportunities
              to present, develop, and share artistic and intellectual work. We aim
              to engage and support emerging creatives through mentorship and
              community-based learning. Towards this end, we collaborate with
              individuals and organizations locally, nationally, and internationally
              in furtherance of these purposes.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="about-lead">
              Our original group was first formed in Newmarket Ontario, Canada,
              1990. We opened the first internet cafe in town, and held concerts
              and raves, as well as other performative, theatrical and literary
              events. Our group has undergone many radical transformations since.
              We helped usher in digital community and new digital group work to
              the internet, and that involved many experiments attempting to adapt
              ever changing web and mobile apps to our work over the years.
              Remaining true to the essence of our celebrated &ldquo;philosophical
              reading groups&rdquo;, often spontaneously hosted, this collective is
              quintessentially nomadic, eclectic, reflexive and dedicated to seeking
              knowledge and passing on what we have met well. Our current
              international collaborations are focused in Paris, Los Angeles and
              Toronto and surrounds, where our founding members are respectively
              situated and engaged in a wide variety of creative acts &amp; inquiries.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
