"use server";

/**
 * The auction journey, from IFAC: where this person stands and the one-click
 * step. The work is `loadAuctionJourney` / `publishStoreForAuction` in
 * @elkdonis/commerce; this file supplies only who is asking. Any signed-in
 * person, not only an IFAC member: a store on the marketplace is a fact about
 * the person, like being payable (see payout-actions.ts).
 */

import { getViewer } from "@/lib/auth";

export async function loadJourneyAction() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Sign in first.");
  const { loadAuctionJourney } = await import("@elkdonis/commerce/server");
  return loadAuctionJourney(viewer.userId);
}

export async function publishStoreAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { publishStoreForAuction } = await import("@elkdonis/commerce/server");
  const { db } = await import("@elkdonis/db");
  const [u] = await db<Array<{ display_name: string | null }>>`SELECT display_name FROM users WHERE id = ${viewer.userId}`;
  const r = await publishStoreForAuction({
    userId: viewer.userId,
    email: viewer.email,
    displayName: u?.display_name ?? viewer.email.split("@")[0],
  });
  return r.ok ? { ok: true } : r;
}


// ── Start an organisation (the Center's "site" journey) ─────────────────────

export async function checkSiteAction(raw: string) {
  const viewer = await getViewer();
  if (!viewer) return { slug: "", ok: false, reason: "invalid" as const };
  const { checkSubdomain } = await import("@elkdonis/services");
  return checkSubdomain(raw);
}

export async function createSiteAction(input: {
  title: string;
  subdomain: string;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { createOrganizationForUser } = await import("@elkdonis/services");
  const r = await createOrganizationForUser({ userId: viewer.userId, title: input.title, subdomain: input.subdomain });
  return r.ok === true ? { ok: true, slug: r.slug } : { ok: false, error: r.error };
}
