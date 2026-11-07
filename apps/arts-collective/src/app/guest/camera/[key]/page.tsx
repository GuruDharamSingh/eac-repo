import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestCamera } from "@elkdonis/reels/broadcast";
import "@elkdonis/reels/guest.css";

/**
 * Guest camera: a person the studio invites goes live from their browser
 * into the relay (WHIP → MediaMTX `in/<key>`), and the studio puts them in
 * a scene. No account: the feed key in the link is the credential, checked
 * by the relay on publish (docker/relay/agent.mjs /auth); deleting the feed
 * revokes the link. The relay's WebRTC endpoint has its own edge host
 * (RELAY_WHIP_BASE, default https://live.arts-collective.com): MediaMTX
 * answers with absolute-path session URLs, so it cannot sit under a prefix.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest camera — Elkdonis Arts Collective",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GuestCameraPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // The relay's feed key format (docker/relay/start.sh paths): anything else cannot publish.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) notFound();
  const base = (process.env.RELAY_WHIP_BASE || "https://live.arts-collective.com").replace(/\/$/, "");
  return <GuestCamera whipUrl={`${base}/in/${key}/whip`} studioName="Elkdonis Arts Collective" />;
}
