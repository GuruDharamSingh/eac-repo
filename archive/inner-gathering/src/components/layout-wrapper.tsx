"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";
import { SiteHeader } from "./site-header";
import { WelcomePopup } from "./welcome-popup";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show nav on login, network-mock previews, or an individual
  // workshop's detail page — that page builds its own compact header out of
  // its hero media instead of the generic site banner (but /workshops/create
  // and /workshops/[id]/edit still get the normal site header + nav).
  const isWorkshopDetail = /^\/workshops\/[^/]+$/.test(pathname) &&
    !pathname.endsWith("/create") &&
    !pathname.endsWith("/edit");
  const showNav =
    pathname !== "/" &&
    pathname !== "/login" &&
    !pathname.startsWith("/network-mock") &&
    !isWorkshopDetail;

  return (
    <>
      {showNav && <SiteHeader />}
      {showNav && <TopNav />}
      {children}
      <Suspense fallback={null}>
        <WelcomePopup />
      </Suspense>
    </>
  );
}
