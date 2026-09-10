"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** The bottom CTA bar: appears after the first screen, hides while #join is on screen. */
export function StickyBar({ signedIn }: { signedIn: boolean }) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolledPast(window.scrollY > window.innerHeight);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = document.querySelector("#join");
    if (!target) return;
    observerRef.current = new IntersectionObserver(([entry]) => setJoinVisible(entry.isIntersecting), { threshold: 0.15 });
    observerRef.current.observe(target);
    return () => observerRef.current?.disconnect();
  }, []);

  const hidden = !scrolledPast || joinVisible;
  const link: React.CSSProperties = {
    fontFamily: '"Venture", Georgia, serif',
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#f0db9d",
    textDecoration: "none",
    padding: "0.6rem 1.2rem",
    border: "1px solid rgba(183,154,85,0.45)",
    borderRadius: 2,
    background: "transparent",
  };

  return (
    <aside
      aria-label="Site navigation"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: "linear-gradient(180deg, rgba(2,34,120,0.97), rgba(1,18,78,0.99))",
        borderTop: "1px solid rgba(183,154,85,0.52)",
        boxShadow: "0 -10px 30px rgba(0,0,0,0.28)",
        padding: "0.85rem clamp(1rem, 4vw, 3rem)",
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1rem",
        transform: hidden ? "translateY(100%)" : "translateY(0)",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "transform 0.35s ease, opacity 0.35s ease",
      }}
    >
      <Link href="/about" style={link}>More About</Link>
      <Link href="/offerings" style={link}>Offerings</Link>
      <Link href={signedIn ? "/hub" : "/login"} style={{ ...link, background: "rgba(183,154,85,0.18)" }}>
        {signedIn ? "Hub" : "Web-Portal"}
      </Link>
    </aside>
  );
}
