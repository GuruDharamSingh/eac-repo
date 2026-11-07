import { headers } from "next/headers";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { siteConfig } from "@/config/site";

/**
 * This site's own public origin, for URLs handed to Stripe and for links in
 * anything sent to a buyer. It is ALWAYS this site: the configured
 * NEXT_PUBLIC_APP_URL, never the marketplace's.
 *
 * The one exception is a build that still carries the `localhost` default
 * (KATIE_THE_POTTER_URL was unset at build time): then the origin the
 * browser used, from the edge's forwarded headers, is the better answer than
 * sending a buyer's card return to localhost. The Host header only ever
 * decides where THIS request's own buyer comes back to.
 */
export async function siteOrigin(): Promise<string> {
  const configured = siteConfig.url.replace(/\/+$/, "");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(configured)) return configured;
  return publicOriginFrom(await headers(), configured).replace(/\/+$/, "");
}
