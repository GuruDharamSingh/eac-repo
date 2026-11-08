import type { Metadata } from "next";
import type { ReactNode } from "react";
// The surface stylesheet is imported here as well as in globals.css: this
// app's CSS pipeline has dropped package @imports from globals before
// (.claude/rules/apps/arts-collective.md).
import "@elkdonis/cms-ui/surface.css";
import "@/components/channel/channel.css";
// After channel.css: the piece view's header and history styles (zero-specificity fallbacks cannot override Channel's).
import "@elkdonis/content/content.css";

export const metadata: Metadata = {
  title: "Channel — Elkdonis Arts Collective",
  robots: { index: false, follow: false },
};

// Provisional type (design README "Fidelity"): Source Serif 4 stands in until
// the owner's palette and faces arrive. Loaded as a stylesheet, like the Studio.
const FONTS = "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap";

/** Channel: the publishing console. docs/open/channel.md. */
export default function ChannelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONTS} />
      <div className="chn">{children}</div>
    </>
  );
}
