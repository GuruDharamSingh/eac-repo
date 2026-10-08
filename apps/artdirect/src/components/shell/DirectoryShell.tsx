import type { ReactNode } from "react";
import { SiteHeader, type NavKey } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/** Header, page, footer — the frame every non-dossier page sits in. */
export function DirectoryShell({ current, children }: { current?: NavKey; children: ReactNode }) {
  return (
    <div className="ad-shell">
      <a className="ad-skip" href="#ad-main">
        Skip to content
      </a>
      <SiteHeader current={current} />
      <main id="ad-main" className="ad-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
