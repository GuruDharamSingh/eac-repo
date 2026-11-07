"use server";

/**
 * The Center journeys on the network host: the auction errand's state and
 * one-click step, and "start an organisation". The work is in
 * @elkdonis/commerce (`loadAuctionJourney`, `publishStoreForAuction`) and
 * @elkdonis/services (`checkSubdomain`, `createOrganizationForUser`); this
 * file supplies only who is asking. Ported from apps/ifac/src/lib/cms/
 * journey-actions.ts for the getting-started course (2026-10-29).
 * Since 2026-11-06 the store, organisation and gain-space steps go through
 * the action registry (@elkdonis/actions, `runAction`); the signatures stay
 * because the journey panels' connectors expect them.
 */

import { getCurrentUser } from "@/lib/session";
import { runAction } from "@/lib/actions/run";

export async function loadJourneyAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const { loadAuctionJourney } = await import("@elkdonis/commerce/server");
  return loadAuctionJourney(user.id);
}

export async function publishStoreAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await runAction("store");
  return r.ok === false ? r : { ok: true };
}

export async function checkSiteAction(raw: string) {
  const user = await getCurrentUser();
  if (!user) return { slug: "", ok: false, reason: "invalid" as const };
  const { checkSubdomain } = await import("@elkdonis/services");
  return checkSubdomain(raw);
}

export async function createSiteAction(input: { title: string; subdomain: string }): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const r = await runAction("org", { title: input?.title ?? "", subdomain: input?.subdomain ?? "" });
  return r.ok === false ? r : { ok: true, slug: String(r.data?.slug ?? "") };
}

/**
 * Take your space in the collective: a folder of your own, membership of the
 * artist directory's org and a directory listing (services' gainSpace, the
 * same call /wizard makes on open). The course's "Take your space" task.
 */
export async function gainSpaceAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await runAction("gain-space");
  return r.ok === false ? r : { ok: true };
}
