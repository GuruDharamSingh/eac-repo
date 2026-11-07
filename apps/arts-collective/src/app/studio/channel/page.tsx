import type { Metadata } from "next";
import { ChannelConsole } from "@elkdonis/studio/channel";
import { requireUser } from "@/lib/session";
import { loadChannel } from "@/lib/channel-data";
import { postArtworkAction } from "@/lib/channel-actions";
// Imported here, not in globals.css: this app's CSS pipeline has dropped
// package @imports from there before (.claude/rules/apps/arts-collective.md).
import "@elkdonis/studio/channel.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Channel — Elkdonis Arts Collective",
  robots: { index: false, follow: false },
};

// Same faces as the Studio (studio/page.tsx explains why by stylesheet, not next/font).
const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

type Props = { searchParams: Promise<{ org?: string; view?: string; notice?: string }> };

/**
 * The Channel console: one acting org (or "Just me") and everything it posts,
 * where it went, and the accounts it posts through. Org sites link here
 * through the SSO hand-off (katie-the-potter /channel).
 * docs/open/CHANNEL_CONSOLE_2026-11-07.md.
 */
export default async function ChannelPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = `/studio/channel${params.org ? `?org=${encodeURIComponent(params.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const data = await loadChannel(user, params);

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
      <ChannelConsole data={data} postArtwork={postArtworkAction} />
    </>
  );
}
