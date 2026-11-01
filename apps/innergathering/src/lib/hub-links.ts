import { handoffUrl } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Off-site addresses the hub's card pages link to, in one place.
 */

const NC = (process.env.NEXTCLOUD_PUBLIC_URL ?? process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/** Nextcloud's public origin, or "" when unset (local dev). */
export const NEXTCLOUD_URL = NC;

/**
 * Nextcloud's "Log in with Elkdonis" entry (sociallogin provider `elkdonis`,
 * the same entry IFAC's hub uses). It hands straight to this app's OIDC
 * provider, so a signed-in member skips Nextcloud's own form; the first visit
 * creates their Nextcloud account.
 */
export const NEXTCLOUD_SIGN_IN = NC ? `${NC}/apps/sociallogin/custom_oauth2/elkdonis` : null;

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
export const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * The network Studio, opened as this org and carrying the sign-in across
 * (the handoff hop). Writing made there is homed on the author's ArtDirect
 * page and listed here (STUDIO_BRIEF_2026-09-27 §4.1); `/studio` on this app
 * is the Puck page builder, not this.
 */
export function studioHref(extra?: Record<string, string>): string {
  const q = new URLSearchParams({ org: siteConfig.orgId, ...extra });
  return handoffUrl(`${NETWORK_URL}/studio?${q.toString()}`);
}
