"use client";

import { useEffect, useRef, useState } from "react";

export function QuestionOfInquiry() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.12 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="inquiry" ref={ref} className="inquiry-section">
      <div className={`section-inner reveal ${visible ? "in-view" : ""}`}>
        <p className="inquiry-lead">
          The artist endeavours to penetrate experience in order to know the self and
          the world. It is a difficult and never ending process to find ways of using
          a medium to interpret something seen and experienced into a form which can
          be received and seen by another. To persevere in this process despite frustration and failure requires
          commitment and work, driven in large part by human necessity.
        </p>
      </div>
    </section>
  );
}
