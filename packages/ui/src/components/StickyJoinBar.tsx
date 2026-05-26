'use client';

/**
 * StickyJoinBar
 *
 * Sticky bottom CTA: "Join Our Collective — Curate Your Art" → #join.
 * Hides itself once the target section is on screen. Mantine-free.
 */

import { useEffect, useRef, useState } from 'react';

export interface StickyJoinBarProps {
  /** CSS selector for the section to anchor to. Default '#join'. */
  targetSelector?: string;
  /** Visible copy. */
  label?: string;
  /** CTA text. */
  ctaLabel?: string;
}

export function StickyJoinBar({
  targetSelector = '#join',
  label = 'Join Our Collective — Curate Your Art',
  ctaLabel = 'Begin',
}: StickyJoinBarProps) {
  const [hidden, setHidden] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observerRef.current.observe(target);
    return () => observerRef.current?.disconnect();
  }, [targetSelector]);

  return (
    <aside
      className="eac-sticky-bar"
      data-hidden={hidden ? 'true' : 'false'}
      role="complementary"
      aria-label="Join the collective"
    >
      <p className="eac-sticky-bar__copy">{label}</p>
      <a className="eac-sticky-bar__cta" href={targetSelector}>
        {ctaLabel}
      </a>
    </aside>
  );
}
