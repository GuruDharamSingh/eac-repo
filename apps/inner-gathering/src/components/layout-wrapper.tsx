"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show nav on login page
  const showNav = pathname !== "/";

  return (
    <>
      {showNav && <TopNav />}
      {children}
    </>
  );
}
