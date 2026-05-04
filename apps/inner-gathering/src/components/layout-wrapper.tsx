"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";
import { WelcomePopup } from "./welcome-popup";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show nav on login or on network-mock previews
  const showNav =
    pathname !== "/" &&
    pathname !== "/login" &&
    !pathname.startsWith("/network-mock");

  return (
    <>
      {showNav && <TopNav />}
      {children}
      <Suspense fallback={null}>
        <WelcomePopup />
      </Suspense>
    </>
  );
}
