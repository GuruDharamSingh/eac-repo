"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface FeaturedArtistConfig {
  eyebrow?: string;
  name?: string;
  description?: string;
  image_url?: string;
  cta?: string;
  goals?: string;
  link1_label?: string;
  link1_url?: string;
  link2_label?: string;
  link2_url?: string;
}

function normalizeMediaPath(path?: string) {
  if (!path) return "";
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  const idx = trimmed.indexOf("EAC_Network/");
  return idx >= 0 ? trimmed.slice(idx) : trimmed;
}

function buildArtistImageSrc(featuredArtistImagePath?: string, fallbackPath?: string) {
  const normalizedMedia = normalizeMediaPath(featuredArtistImagePath);
  if (normalizedMedia) {
    return `/api/media/file?path=${encodeURIComponent(normalizedMedia)}`;
  }

  const fallback = (fallbackPath ?? "").trim();
  if (!fallback) return "/danamccool.jpg";
  if (fallback.startsWith("http://") || fallback.startsWith("https://") || fallback.startsWith("/")) {
    return fallback;
  }
  return `/${fallback.replace(/^\/+/, "")}`;
}

export function FeaturedGrantProgram() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<FeaturedArtistConfig>({});
  const [imageSpaces, setImageSpaces] = useState<Record<string, { path?: string }>>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/admin/site-config?key=featured_artist')
      .then((r) => r.json())
      .then((d) => { if (d.value) setCfg(d.value); })
      .catch(() => {});

    fetch('/api/admin/site-config?key=image_spaces')
      .then((r) => r.json())
      .then((d) => {
        if (d.value && typeof d.value === 'object') {
          setImageSpaces(d.value as Record<string, { path?: string }>);
        }
      })
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
  const featuredArtistImagePath = imageSpaces.featured_artist?.path;
  const imageUrl = buildArtistImageSrc(featuredArtistImagePath, cfg.image_url);
  const cta = cfg.cta ?? "Make an Inquiry";
  const goals = cfg.goals ?? "";
  const link1Label = cfg.link1_label ?? "";
  const link1Url = cfg.link1_url ?? "";
  const link2Label = cfg.link2_label ?? "";
  const link2Url = cfg.link2_url ?? "";

  const hasGoalsContent = Boolean(
    goals || (link1Url && link1Label) || (link2Url && link2Label)
  );

  return (
    <section id="grant-program" ref={ref} className="grant-section">
      <div className={`section-inner reveal ${visible ? "in-view" : ""}`} style={{
        display: "grid",
        gridTemplateColumns: hasGoalsContent
          ? "minmax(120px, 180px) 1fr 1fr"
          : "minmax(120px, 180px) 1fr",
        gap: "2.5rem",
        alignItems: "start",
      }}>
        {/* Left: eyebrow above the image */}
        <div className="grant-left">
          <p className="section-eyebrow" style={{ margin: "0 0 0.75rem" }}>{eyebrow}</p>
          <div className="grant-image">
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 860px) 100vw, 200px"
              style={{ objectFit: "cover", objectPosition: "top" }}
            />
          </div>
        </div>

        {/* Right: name on top, practice description below */}
        <div className="grant-right">
          <h2 className="section-heading" style={{ margin: 0 }}>{name}</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.25rem 0 1.5rem" } as React.CSSProperties} />
          <p className="grant-body">{description}</p>
        </div>

        {/* Right: goals + links — only when there is content */}
        {hasGoalsContent && (
          <div style={{ borderLeft: "1px solid rgba(198,164,90,0.18)", paddingLeft: "2rem" }}>
            <p className="section-eyebrow">Goals &amp; Work</p>
            <hr className="gold-rule" style={{ "--rule-width": "40px", margin: "1rem 0 1.5rem" } as React.CSSProperties} />
            {goals && (
              <p className="grant-body" style={{ marginBottom: "1.5rem" }}>{goals}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {link1Url && link1Label && (
                <a href={link1Url} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: "inline-flex", fontSize: "0.75rem", height: 40 }}>
                  {link1Label}
                </a>
              )}
              {link2Url && link2Label && (
                <a href={link2Url} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: "inline-flex", fontSize: "0.75rem", height: 40 }}>
                  {link2Label}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
