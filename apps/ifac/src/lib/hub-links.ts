import { handoffUrl } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Off-site addresses the hub's pages link to. Server-only: `@elkdonis/auth-server`
 * is not for the client bundle, so pages compute these and pass strings down.
 * Same construction as innergathering's `src/lib/hub-links.ts`.
 */

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * The network Studio (arts-collective `/studio`), opened as this org, through
 * this site's `/api/auth/handoff` so the sign-in travels with the member.
 */
export function studioHref(extra?: Record<string, string>): string {
  const q = new URLSearchParams({ org: siteConfig.orgId, ...extra });
  return handoffUrl(`${NETWORK_URL}/studio?${q.toString()}`);
}
