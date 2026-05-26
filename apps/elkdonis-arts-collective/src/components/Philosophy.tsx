"use client";

import { useEffect, useRef, useState } from "react";

const pillars = [
  {
    num: "I",
    title: "Essentialism",
    body: "We use recognizable objects to convey emotions and ideas, stripping away unnecessary elements to reveal the essence of the art piece. This reductionist approach allows us to create powerful, abstract works that resonate with viewers.",
  },
  {
    num: "II",
    title: "Timelessness",
    body: "Our art exists outside the confines of time, inviting viewers to experience the eternal present. By freezing moments in time, we unlock new dimensions of perception and emotional connection.",
  },
  {
    num: "III",
    title: "Space",
    body: "We prioritize the viewer's experience, crafting scenes that envelop and engage. Our art establishes a sense of space that transcends physical boundaries, drawing the viewer into a profound relationship with the work.",
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
          <h2 className="section-heading">Our Philosophy</h2>
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
