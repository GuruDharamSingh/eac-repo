"use server";

/**
 * The Center journeys on the network host: the auction errand's state and
 * one-click step, and "start an organisation". The work is in
 * @elkdonis/commerce (`loadAuctionJourney`, `publishStoreForAuction`) and
 * @elkdonis/services (`checkSubdomain`, `createOrganizationForUser`); this
 * file supplies only who is asking. Ported from apps/ifac/src/lib/cms/
 * journey-actions.ts for the getting-started course (2026-10-29).
 */

import { getCurrentUser } from "@/lib/session";

export async function loadJourneyAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const { loadAuctionJourney } = await import("@elkdonis/commerce/server");
  return loadAuctionJourney(user.id);
}

export async function publishStoreAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { publishStoreForAuction } = await import("@elkdonis/commerce/server");
  const { db } = await import("@elkdonis/db");
  const [u] = await db<Array<{ display_name: string | null }>>`SELECT display_name FROM users WHERE id = ${user.id}`;
  const r = await publishStoreForAuction({
    userId: user.id,
    email: user.email,
    displayName: u?.display_name ?? user.email.split("@")[0],
  });
  return r.ok ? { ok: true } : r;
}

export async function checkSiteAction(raw: string) {
  const user = await getCurrentUser();
  if (!user) return { slug: "", ok: false, reason: "invalid" as const };
  const { checkSubdomain } = await import("@elkdonis/services");
  return checkSubdomain(raw);
}

export async function createSiteAction(input: { title: string; subdomain: string }): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { createOrganizationForUser } = await import("@elkdonis/services");
  const r = await createOrganizationForUser({ userId: user.id, title: input.title, subdomain: input.subdomain });
  return r.ok === true ? { ok: true, slug: r.slug } : { ok: false, error: r.error };
}

/**
 * Take your space in the collective: a folder of your own, membership of the
 * artist directory's org and a directory listing (services' gainSpace, the
 * same call /wizard makes on open). The course's "Take your space" task.
 */
export async function gainSpaceAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { gainSpace } = await import("@elkdonis/services");
  try {
    await gainSpace(user.id);
    return { ok: true };
  } catch (err) {
    console.error("[learn] gainSpaceAction:", err);
    return { ok: false, error: "Could not set that up. Try again." };
  }
}
