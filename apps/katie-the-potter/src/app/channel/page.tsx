import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { handoffUrl } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Channel", robots: { index: false, follow: false } };

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * /channel is a redirect, like /center: the Channel console (posts per piece,
 * social accounts, publish history, links to video, writing and newsletter)
 * lives once on the network Studio, for every org, at
 * <network>/studio/channel?org=<org_id>. The SSO hop carries the session.
 * docs/open/CHANNEL_CONSOLE_2026-11-07.md.
 */
export default async function ChannelRoute() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) redirect("/login?next=/channel");
  redirect(handoffUrl(`${NETWORK_URL}/studio/channel?org=${encodeURIComponent(siteConfig.orgId)}`));
}
