"use client";

import { usePathname, useRouter } from "next/navigation";

// Auto back button for every non-root phone screen (Justin, 2026-11-15). Mounted once in MobileShell (md:hidden).
// CSS shows it only on pages that draw a phone tree (.elk-m) and that have no back button of their own
// (see .m-back-auto in mobile.css), so screens with their own BackButton are unchanged.
const NO_BACK = new Set(["/", "/tours", "/experiences", "/artist", "/manage"]);

function parentOf(p: string): string {
  if (p.startsWith("/artist/")) return "/artist";
  if (p.startsWith("/manage/")) return "/manage";
  return p.split("/").slice(0, -1).join("/") || "/";
}

export function PhoneBack() {
  const pathname = usePathname();
  const router = useRouter();
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if (NO_BACK.has(p)) return null;
  return (
    <button
      type="button"
      className="m-back m-back-auto"
      aria-label="Back"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(parentOf(p));
      }}
    >
      ←
    </button>
  );
}
