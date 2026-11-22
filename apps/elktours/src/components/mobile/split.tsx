import type { ReactNode } from "react";

/**
 * The two layouts of one guest page (G2, 2026-11-15). The phone tree shows below md, today's tree from md up; both
 * are drawn from the data the page fetched once, and the switch is CSS only. `data-mobile-tree` marks the phone
 * wrapper so the shell can hide the desktop header and footer below md (G1 uses the same marker). Heavy media in the
 * phone tree must mount behind useIsMobile(), as the desktop tree would otherwise load it twice.
 */
export function Split({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  return (
    <>
      <div className="elk-m md:hidden" data-mobile-tree="">
        {mobile}
      </div>
      <div className="hidden md:block">{desktop}</div>
    </>
  );
}
