"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show nav on login page or on network-mock previews
  const showNav = pathname !== "/" && !pathname.startsWith("/network-mock");

  return (
    <>
      {showNav && <TopNav />}
      {children}
    </>
  );
}
