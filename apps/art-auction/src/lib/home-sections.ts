import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

// ============================================================================
// The two sections around the landing hero (2026-10-29, Welcome 4 on
// https://claude.ai/artifact/WS42RxEnjidTqmhqKbumJ5): the welcome letter above
// it and the loft scene below it (`landing-loft.ts`). Both are marketplace
// settings in `site_config` (org `market`).
// ============================================================================

export const WELCOME_KEY = "home_welcome";

export interface WelcomeContent {
  heading: string;
  subline: string;
  body: string;
  linkLabel: string;
  linkHref: string;
}

export const DEFAULT_WELCOME: WelcomeContent = {
  heading: "Welcome.",
  subline: "Collect Art · market.arts-collective.com",
  body:
    "Collect Art is the new home of the IFAC auction. International Fine Art Collectors presents auction series; " +
    "Arts Collective Network hosts them; and the market around it carries original work from artists across the collective.",
  linkLabel: "Read more about the site",
  linkHref: "/about",
};

const text = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback;

/** Only a path on this site or an https link: the label is drawn as a link anyone clicks. */
const href = (v: unknown, fallback: string) =>
  typeof v === "string" && /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(v.trim()) ? v.trim().slice(0, 300) : fallback;

export function cleanWelcome(v: unknown): WelcomeContent {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    heading: text(o.heading, 60, DEFAULT_WELCOME.heading),
    subline: text(o.subline, 120, ""),
    body: text(o.body, 1200, DEFAULT_WELCOME.body),
    linkLabel: text(o.linkLabel, 80, DEFAULT_WELCOME.linkLabel),
    linkHref: href(o.linkHref, DEFAULT_WELCOME.linkHref),
  };
}

/** A marketplace setting (`site_config`, org market); null when unset or unreadable. */
export async function loadValue(key: string): Promise<unknown> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.marketplaceOrgId} AND key = ${key}
    `) as unknown as Array<{ value: unknown }>;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Write a marketplace setting, replacing the whole value. */
export async function saveValue(key: string, value: unknown): Promise<void> {
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${siteConfig.marketplaceOrgId}, ${key}, ${db.json(value as never)}, now())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function loadWelcome(): Promise<WelcomeContent> {
  const v = await loadValue(WELCOME_KEY);
  return v ? cleanWelcome(v) : DEFAULT_WELCOME;
}

export async function saveWelcome(content: WelcomeContent): Promise<void> {
  await saveValue(WELCOME_KEY, cleanWelcome(content));
}
