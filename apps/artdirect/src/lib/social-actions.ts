"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import {
  connectionStartUrl,
  createConnection,
  forgetSocialFeeds,
  listConnections,
} from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// Instagram and YouTube on the signed-in person's own ArtDirect page
// (2026-11-01). Both act on the session's user only; nothing takes a user id
// from the request. Consent runs on the network host (arts-collective
// /api/connections/start), which brings the person back to their page.
// ============================================================================

const SECTION_KEYS = ["instagram", "youtube"] as const;
type SocialKey = (typeof SECTION_KEYS)[number];

async function ownSlug(userId: string): Promise<string | null> {
  const [row] = await db<{ slug: string | null }[]>`SELECT slug FROM users WHERE id = ${userId}`;
  return row?.slug ?? null;
}

/**
 * Start connecting Instagram or YouTube. Reuses an unfinished connection of
 * the same kind rather than adding a row per click. Returns the address to
 * navigate to: the network host's consent start, wrapped in this site's
 * handoff so the sign-in travels with the person.
 */
export async function connectSocialAction(
  provider: SocialKey
): Promise<{ ok: boolean; href?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(SECTION_KEYS as readonly string[]).includes(provider)) return { ok: false, error: "Unknown account type." };
  const slug = await ownSlug(user.id);
  if (!slug) return { ok: false, error: "Your page has no address yet." };

  const mine = await listConnections(user.id);
  let id = mine.find((c) => c.provider === provider && c.status !== "connected" && c.collective)?.id;
  if (!id) {
    const made = await createConnection(user.id, { provider });
    if (made.ok === false) return { ok: false, error: made.error };
    id = made.connection.id;
  }
  const origin = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
  const start = connectionStartUrl(id, `${origin}/${slug}`);
  return { ok: true, href: `/api/auth/handoff?to=${encodeURIComponent(start)}` };
}

/**
 * Show or hide the Instagram or YouTube section on the person's page
 * (users.profile_sections, merged so other keys survive). Off by default.
 */
export async function setSocialSectionAction(key: SocialKey, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(SECTION_KEYS as readonly string[]).includes(key)) return { ok: false, error: "Unknown section." };
  await db`
    UPDATE users
    SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({ [key]: Boolean(on) } as never)}
    WHERE id = ${user.id}
  `;
  forgetSocialFeeds(user.id);
  const slug = await ownSlug(user.id);
  if (slug) revalidatePath(`/${slug}`);
  return { ok: true };
}
