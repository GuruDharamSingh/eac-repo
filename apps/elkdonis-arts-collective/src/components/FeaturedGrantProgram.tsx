"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface FeaturedArtistConfig {
  eyebrow?: string;
  name?: string;
  description?: string;
  image_url?: string;
  cta?: string;
}

export function FeaturedGrantProgram() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<FeaturedArtistConfig>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/admin/site-config?key=featured_artist')
      .then((r) => r.json())
      .then((d) => { if (d.value) setCfg(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const eyebrow = cfg.eyebrow ?? "Featured Arts";
  const name = cfg.name ?? "Dana McCool";
  const description = cfg.description ?? "Surrealist Writing";
  const imageUrl = cfg.image_url ?? "/danamccool.jpg";
  const cta = cfg.cta ?? "Make an Inquiry";

  return (
    <section id="grant-program" ref={ref} className="grant-section">
      <div className={`section-inner grant-grid reveal ${visible ? "in-view" : ""}`}>
        <div className="grant-image">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 860px) 100vw, 420px"
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        </div>
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="section-heading">{name}</h2>
          <hr
            className="gold-rule"
            style={{ "--rule-width": "50px", margin: "1.5rem 0 2rem" } as React.CSSProperties}
          />
          <p className="grant-body">{description}</p>
          <a href="#contact" className="cta-btn" style={{ marginTop: "1.5rem", display: "inline-flex" }}>
            {cta}
          </a>
        </div>
      </div>
    </section>
  );
}
