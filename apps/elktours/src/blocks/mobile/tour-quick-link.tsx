"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * A tour card on the phone pages. A tap goes straight to the tour page (developer, 2026-11-21: no popup on the phone
 * landing); it used to open the quick overview popup (`surface/tour-quick-popup.tsx`, still used elsewhere).
 */
export function TourQuickLink({ slug, className, style, children }: { slug: string; title?: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    // No prefetch (2026-11-17): /tours prefetched every tour at once; an aborted prefetch then failed a chunk load
    // (ChunkLoadError) and tripped the error page in fresh browsers.
    <Link href={`/tours/${slug}`} prefetch={false} className={className} style={style}>
      {children}
    </Link>
  );
}
