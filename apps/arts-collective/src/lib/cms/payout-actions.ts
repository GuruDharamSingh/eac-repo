"use server";

/**
 * The Payouts tab of the profile popup and the "Get paid" step of the
 * journeys, on the network host. The connected account, the ledger and the
 * Stripe platform are network-wide, so a person who sets this up here is set
 * up everywhere. The work is `startPayoutsFor` in @elkdonis/checkout; this
 * file supplies who is asking and where Stripe returns them: the page they
 * pressed the button on (a course step, the hub), read from the Referer, so
 * the step that sent them re-reads Stripe on `?payouts=done`.
 * Ported from apps/ifac/src/lib/cms/payout-actions.ts (2026-10-29).
 */

import { headers } from "next/headers";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";

type SectionRow = {
  profile_sections: Record<string, unknown> | null;
  slug: string | null;
  stripe_account_id: string | null;
  stripe_onboarded_at: string | null;
  country: string | null;
};

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.ARTS_COLLECTIVE_URL ?? "http://localhost:3007").replace(/\/$/, "");

/** Sections a person's ArtDirect page renders from `users.profile_sections`. */
const KNOWN_SECTIONS = ["blog", "store"] as const;
const SECTION_LABELS: Record<(typeof KNOWN_SECTIONS)[number], { label: string; blurb: string }> = {
  blog: { label: "Writing", blurb: "A shelf of what you've written, on your page." },
  store: { label: "Store", blurb: "Your work for sale, as a window onto the market." },
};

export async function loadProfilePageAction() {
  const user = await getCurrentUser();
  if (!user) return { sections: [], payouts: null };
  const [row] = await db<SectionRow[]>`
    SELECT profile_sections, slug, stripe_account_id, stripe_onboarded_at, country
    FROM users WHERE id = ${user.id} LIMIT 1
  `;
  const sections = row?.profile_sections ?? {};
  const slug = row?.slug ?? null;
  const { PAYOUT_ONBOARDING_COPY } = await import("@elkdonis/checkout/stripe");
  return {
    sections: KNOWN_SECTIONS.map((key) => ({
      key,
      label: SECTION_LABELS[key].label,
      blurb: SECTION_LABELS[key].blurb,
      on: Boolean(sections[key]),
      blockedReason: slug ? null : "Your account has no page address yet.",
      href: slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}` : null,
    })),
    payouts: {
      available: Boolean(process.env.STRIPE_SECRET_KEY),
      state: row?.stripe_onboarded_at ? ("ready" as const) : row?.stripe_account_id ? ("pending" as const) : ("none" as const),
      accountLabel: row?.stripe_account_id ?? null,
      country: row?.country ?? null,
      onboarding: PAYOUT_ONBOARDING_COPY,
    },
  };
}

/** Flip one optional section. Merged, never replacing the whole object. */
export async function setProfileSectionAction(key: string, on: boolean): Promise<{ ok: true; href?: string | null } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(KNOWN_SECTIONS as readonly string[]).includes(key)) return { ok: false, error: "No such section." };
  try {
    const [row] = await db<Array<{ slug: string | null }>>`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({ [key]: on } as never)}
      WHERE id = ${user.id}
      RETURNING slug
    `;
    return { ok: true, href: row?.slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${row.slug}` : null };
  } catch (error) {
    console.error("[learn] setProfileSectionAction:", error);
    return { ok: false, error: "Could not save that." };
  }
}

/** The page the request came from, as a path on this host; else the hub. */
async function returnPath(): Promise<string> {
  const ref = (await headers()).get("referer");
  try {
    if (ref) {
      const u = new URL(ref);
      if (u.origin === ORIGIN && u.pathname.startsWith("/") && !u.pathname.startsWith("//")) {
        u.searchParams.delete("payouts");
        return `${u.pathname}${u.search}`;
      }
    }
  } catch {
    // fall through
  }
  return "/hub/network";
}

/** Begin (or resume) Stripe Express onboarding. */
export async function startPayoutsAction(country?: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  const back = await returnPath();
  return startPayoutsFor({
    userId: user.id,
    email: user.email,
    origin: ORIGIN,
    // startPayoutsFor appends ?payouts=done / ?payouts=refresh itself.
    returnPath: back,
    country,
  });
}

export async function disconnectPayoutsAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { disconnectPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return disconnectPayoutsFor(user.id);
}
