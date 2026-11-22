"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalCarouselProps {
  kicker?: string;
  title: string;
  count?: number;
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * Generic 2-at-a-time horizontal carousel.
 *
 * Each child should set `flex: 0 0 calc(50% - gap/2)` (or 100% under 600px)
 * via the CSS class `.feed-carousel-item` so two snap into view at a time and
 * paged scrolls land cleanly. Use the `.feed-carousel-item` class on direct
 * children to opt in.
 */
export function HorizontalCarousel({
  kicker,
  title,
  count,
  headerRight,
  children,
}: HorizontalCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [canPage, setCanPage] = useState(false);

  const refreshEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    setCanPage(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    refreshEdges();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", refreshEdges, { passive: true });
    const ro = new ResizeObserver(refreshEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", refreshEdges);
      ro.disconnect();
    };
  }, [refreshEdges, children]);

  const page = useCallback((dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }, []);

  return (
    <section className="feed-carousel">
      <header className="feed-carousel__header">
        <div className="feed-carousel__heading">
          {kicker && <p className="feed-carousel__kicker">{kicker}</p>}
          <h3 className="feed-carousel__title">
            {title}
            {typeof count === "number" && (
              <span className="feed-carousel__count">{count}</span>
            )}
          </h3>
        </div>
        <div className="feed-carousel__controls">
          {headerRight}
          {canPage && (
            <div className="feed-carousel__arrows" role="group" aria-label="Carousel navigation">
              <button
                type="button"
                className="feed-carousel__arrow"
                onClick={() => page(-1)}
                disabled={atStart}
                aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="feed-carousel__arrow"
                onClick={() => page(1)}
                disabled={atEnd}
                aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="feed-carousel__track">
        {children}
      </div>
    </section>
  );
}
