import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { handoffUrl } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Center", robots: { index: false, follow: false } };

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * /center is a redirect, not a page (SOCIALS_DEBATE: per-app centers become
 * redirects to the network's). Signed out: sign in first and come back.
 * Signed in: through the network's SSO hop to the network Center
 * (<network>/hub/network), carrying the session.
 *
 * Why not <network>/sites/katie-the-potter/center: that route exists but is
 * the copy a subdomain's middleware rewrites to, and it answers a direct
 * request with a redirect to /login. Subdomains for orgs without their own
 * domain are not used (buildOrgSiteCenterLinks, host-links.ts, says so), so
 * the network hub is the reliable target: checked 200.
 */
export default async function CenterRoute() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) redirect("/login?next=/center");
  redirect(handoffUrl(`${NETWORK_URL}/hub/network`));
}
