'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function MarketingStickyBar() {
  const router = useRouter();
  const [scrolledPast, setScrolledPast] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Show after scrolling past one viewport height
  useEffect(() => {
    function onScroll() {
      setScrolledPast(window.scrollY > window.innerHeight);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hide again when the #join section is visible
  useEffect(() => {
    const target = document.querySelector('#join');
    if (!target) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => setJoinVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observerRef.current.observe(target);
    return () => observerRef.current?.disconnect();
  }, []);

  const hidden = !scrolledPast || joinVisible;

  function handlePortal() {
    router.push('/feed');
  }

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 80,
        background: 'linear-gradient(180deg, rgba(2,34,120,0.97), rgba(1,18,78,0.99))',
        borderTop: '1px solid rgba(183,154,85,0.52)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.28)',
        padding: '0.85rem clamp(1rem, 4vw, 3rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '1rem',
        transform: hidden ? 'translateY(100%)' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'transform 0.35s ease, opacity 0.35s ease',
      }}
      aria-label="Site navigation"
    >
      <Link
        href="/about"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#f0db9d',
          textDecoration: 'none',
          padding: '0.6rem 1.2rem',
          border: '1px solid rgba(183,154,85,0.45)',
          borderRadius: 2,
          transition: 'background 0.2s, color 0.2s',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(183,154,85,0.18)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
        }}
      >
        More About
      </Link>
      <button
        type="button"
        onClick={handlePortal}
        disabled={false}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#161610',
          background: 'var(--eac-gilt, #b79a55)',
          border: '1px solid #f0db9d',
          borderRadius: 2,
          padding: '0.6rem 1.2rem',
          cursor: 'pointer',
          transition: 'background 0.2s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f0db9d')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--eac-gilt, #b79a55)')}
      >
        Web Portal
      </button>
    </aside>
  );
}