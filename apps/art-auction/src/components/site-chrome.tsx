"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Hides the marketplace header and footer on pages that draw their own: the
 * series page template (`/series/<slug>`), its invitations page, the series
 * workspace (`/series/<slug>/manage/*`) and About. All follow the 2026-10-28
 * mock-ups.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname === "/about" || /^\/series\/[^/]+(\/manage(\/.*)?|\/invitations)?$/.test(pathname)) return null;
  return <>{children}</>;
}
