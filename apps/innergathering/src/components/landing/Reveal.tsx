"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing's reveal-on-scroll, as one wrapper instead of a copy of the
 * IntersectionObserver in every section. Content is visible at rest for
 * anyone without JavaScript or with reduced motion; the class only adds the
 * rise.
 */
export function Reveal({
  as: Tag = "div",
  className = "",
  threshold = 0.1,
  id,
  style,
  children,
}: {
  as?: "div" | "section" | "ul" | "aside";
  className?: string;
  threshold?: number;
  id?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} id={id} style={style} className={`reveal ${visible ? "in-view" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
