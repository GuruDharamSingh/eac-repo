import "./mobile.css";
import { Suspense, type ReactNode } from "react";
import { GuestTabBar } from "./guest-tab-bar";
import { BoardTabBar } from "./board-nav";
import { MobileOverlays } from "./overlays";
import { PhoneBack } from "./phone-back";

/**
 * Mounted once in app/layout.tsx. Visible below md only. Holds the bottom nav.
 * Sheets are controlled by the screens that open them (radix portal) and toasts
 * by the Toaster, so there is no host element to manage here.
 * `nav="board"` draws the board bar (Board, +, Schedule) with `badge` as the count; the board pages also draw it
 * themselves, so the root layout keeps nav="guest" (the guest bar shows only on its three root paths).
 */
export function MobileShell({ nav = "guest", badge, children }: { nav?: "guest" | "board" | null; badge?: number; children?: ReactNode }) {
  return (
    <div className="m-shell md:hidden" data-m-shell="">
      <PhoneBack />
      {nav === "guest" ? <GuestTabBar /> : null}
      {nav === "board" ? <BoardTabBar count={badge} /> : null}
      {/* Place sheet, post preview and web view (G5/G6): opened by ?place=, ?post= and openWebView(). */}
      <Suspense fallback={null}>
        <MobileOverlays />
      </Suspense>
      {children}
    </div>
  );
}
