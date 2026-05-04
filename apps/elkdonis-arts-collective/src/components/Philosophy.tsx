"use client";

import { useEffect, useRef, useState } from "react";

const pillars = [
  {
    num: "I",
    title: "Art is Necessary",
    body: "We hold that art is not decoration, entertainment, or product — it is a primary means by which human beings make contact with reality. To remove art from a life is to thin the very fabric of that life.",
  },
  {
    num: "II",
    title: "Attention is Medium",
    body: "The quality of presence brought to a work — by its maker and its witness — is the substance of art itself. Technique serves attention; attention is not a by-product of technique.",
  },
  {
    num: "III",
    title: "Mutual Aid is Practice",
    body: "We refuse the isolation of the solitary genius. Artists sustain one another through honest exchange, shared labour, and the willingness to be changed by what we encounter in each other's work.",
  },
  {
    num: "IV",
    title: "Transformation is the Work",
    body: "Our programming is not aimed at career development or cultural product. It is aimed at the interior development of the human being. We are a Fourth-Way Mutual Aid Society — the work transforms the worker.",
  },
];

export function Philosophy() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="philosophy" ref={ref} className="philosophy-section">
      <div className="section-inner">
        <div className={`reveal ${visible ? "in-view" : ""}`} style={{ textAlign: "center", marginBottom: "4rem" }}>
          <p className="section-eyebrow">Our Philosophy</p>
          <h2 className="section-heading">What We Believe</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "2rem",
          }}
        >
          {pillars.map((p, i) => (
            <article
              key={p.num}
              className={`philosophy-card reveal ${visible ? "in-view" : ""}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <span className="philosophy-num" aria-hidden="true">{p.num}</span>
              <h3 className="philosophy-title">{p.title}</h3>
              <p className="philosophy-body">{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
