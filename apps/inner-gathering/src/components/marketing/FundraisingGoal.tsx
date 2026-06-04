"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Instagram, BookOpen, ExternalLink } from "lucide-react";

const SOCIAL_LINKS = [
  {
    label: "GoFundMe",
    url: "https://www.gofundme.com/f/empowering-artists-in-toronto-and-la",
    Icon: Heart,
  },
  {
    label: "Instagram",
    url: "https://www.instagram.com/Elkdonisarts",
    Icon: Instagram,
  },
  {
    label: "Substack",
    url: "https://elkdonisarts.substack.com/",
    Icon: BookOpen,
  },
];

interface FundraisingConfig {
  goal?: number;
  raised?: number;
  status?: string;
  url?: string;
  cta?: string;
}

interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

function useSubstackPosts() {
  const [posts, setPosts] = useState<SubstackPost[]>([]);
  useEffect(() => {
    // Use a CORS proxy to fetch the Substack RSS feed client-side
    fetch("/api/substack-feed")
      .then((r) => r.json())
      .then((data: SubstackPost[]) => { if (Array.isArray(data)) setPosts(data.slice(0, 3)); })
      .catch(() => {});
  }, []);
  return posts;
}

export function FundraisingGoal() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<FundraisingConfig>({});
  const ref = useRef<HTMLElement>(null);
  const substackPosts = useSubstackPosts();

  useEffect(() => {
    fetch('/api/admin/site-config?key=fundraising')
      .then((r) => r.json())
      .then((d) => { if (d.value) setCfg(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const raised = cfg.raised ?? 0;
  const goal = cfg.goal ?? 25000;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const gofundmeUrl = "https://www.gofundme.com/f/empowering-artists-in-toronto-and-la";

  return (
    <section id="fundraising" ref={ref} className="fundraising-section">
      <div className="section-inner" style={{ maxWidth: "1040px" }}>
        <div className={`reveal ${visible ? "in-view" : ""}`}>

          {/* Header — full width, centred */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p className="section-eyebrow">Community Support</p>
            <h2 className="section-heading">Fundraising Goal</h2>
            <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />
          </div>

          {/* Two-column body */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2rem",
            alignItems: "start",
          }}>

            {/* Left — fundraising + social */}
            <div style={{
              background: "rgba(255, 253, 248, 0.82)",
              border: "1px solid rgba(183,154,85,0.32)",
              borderRadius: 4,
              padding: "1.5rem",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", color: "#3a3a44", lineHeight: 1.8, marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                We Will Specialize in Grant Writing, Finding, and Even Our Own Micro Grants
              </p>

              {raised > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#5a5240", marginBottom: "0.4rem" }}>
                    <span>CAD ${raised.toLocaleString()} raised</span>
                    <span>Goal: ${goal.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height: 5, background: "rgba(1,18,78,0.12)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #b79a55, #8f763c)", borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
              )}

              <a
                href={gofundmeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-btn"
                style={{ display: "inline-flex", marginBottom: "1.5rem" }}
              >
                <Heart size={15} />
                Support on GoFundMe
              </a>

              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                {SOCIAL_LINKS.map(({ label, url, Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#8f763c",
                      textDecoration: "none",
                      opacity: 0.9,
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.9")}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Right — Substack feed in one scrollable box */}
            <div style={{
              background: "rgba(255, 253, 248, 0.82)",
              border: "1px solid rgba(183,154,85,0.32)",
              borderRadius: 4,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid rgba(183,154,85,0.25)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}>
                <BookOpen size={13} strokeWidth={1.6} style={{ color: "#8f763c", flexShrink: 0 }} />
                <span style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8f763c",
                  fontWeight: 600,
                }}>
                  Recent from Substack
                </span>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "260px" }}>
                {substackPosts.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", color: "#6b6250", padding: "1rem", margin: 0 }}>
                    Loading articles…
                  </p>
                ) : (
                  substackPosts.map((post, i) => (
                    <a
                      key={post.link}
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                        padding: "0.7rem 1rem",
                        borderBottom: i < substackPosts.length - 1 ? "1px solid rgba(183,154,85,0.18)" : "none",
                        textDecoration: "none",
                        color: "inherit",
                        background: "transparent",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(183,154,85,0.12)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.88rem", fontWeight: 500, color: "#01124E", margin: "0 0 0.2rem", lineHeight: 1.35 }}>
                          {post.title}
                        </p>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.65rem", color: "#6b6250", margin: 0 }}>
                          {new Date(post.pubDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <ExternalLink size={12} style={{ flexShrink: 0, color: "#8f763c", marginTop: 2 }} />
                    </a>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
