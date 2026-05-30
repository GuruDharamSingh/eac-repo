"use client";

import { useEffect, useRef, useState } from "react";

export function CitiesVision() {
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
    <>
      {/* Cities band */}
      <section
        ref={ref}
        className={`reveal ${visible ? "in-view" : ""}`}
        style={{
          background: "#2a5a2a",
          padding: "5rem 4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1.5rem 4rem" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#dde8d0", letterSpacing: "0.04em" }}>Toronto</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(221,232,208,0.4)" }}>Operations · Technology · Performance</span>
        </div>

        <div style={{ width: 1, height: 60, background: "rgba(221,232,208,0.15)", alignSelf: "center" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1.5rem 4rem" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#dde8d0", letterSpacing: "0.04em" }}>Los Angeles</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(221,232,208,0.4)" }}>Music · Education · Outreach</span>
        </div>

        <div style={{ width: 1, height: 60, background: "rgba(221,232,208,0.15)", alignSelf: "center" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1.5rem 4rem" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#dde8d0", letterSpacing: "0.04em" }}>Paris</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(221,232,208,0.4)" }}>Research · Writing · European Networks</span>
        </div>
      </section>

    </>
  );
}

export function VisionStatement() {
  return (
    <section
      style={{
        background: "#060a06",
        borderTop: "1px solid rgba(80,160,80,0.1)",
        padding: "8rem 4rem",
        textAlign: "center",
      }}
    >
      <blockquote
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
          fontStyle: "italic",
          fontWeight: 300,
          lineHeight: 1.9,
          color: "#3a5a3a",
          maxWidth: 700,
          margin: "0 auto 2.5rem",
          border: "none",
          padding: 0,
        }}
      >
        &ldquo;The collective is committed to using art as the means of inquiry.
        Each inquiry focuses on a particular question that is grounded in
        what it is to be human. We are unique in our purpose and are not
        commercial. Our works are intended to be experienced, not sold.&rdquo;
      </blockquote>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.75rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "#2a4a2a",
          margin: 0,
        }}
      >
        Elkdonis Arts Collective &mdash; Founded, Toronto
      </p>
    </section>
  );
}
