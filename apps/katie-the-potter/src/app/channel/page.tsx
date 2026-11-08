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
 * /channel is a redirect, like /center: the Channel console (each piece and
 * where it went, the queue, plans, cross-posting) lives once on the network
 * host, for every org, at <network>/channel?org=<org_id>. The SSO hop carries
 * the session. docs/open/channel.md.
 */
export default async function ChannelRoute({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  // `?to=outlets` lands on Channel's Outlets, where accounts are connected (Manage overview, "Sharing").
  const outlets = to === "outlets";
  const viewer = await getViewer().catch(() => null);
  if (!viewer) redirect(outlets ? "/login?next=%2Fchannel%3Fto%3Doutlets" : "/login?next=/channel");
  const org = encodeURIComponent(siteConfig.orgId);
  redirect(handoffUrl(outlets ? `${NETWORK_URL}/channel/outlets?org=${org}&tab=instagram` : `${NETWORK_URL}/channel?org=${org}`));
}
