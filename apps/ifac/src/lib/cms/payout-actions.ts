"use server";

/**
 * The Payouts tab of IFAC's profile popup.
 *
 * IFAC does not run a checkout — its artist pages are a window onto the
 * art-auction store, not a till of their own. Being payable is still an IFAC
 * question, because it is where its artists already are: the connected
 * account, the ledger and the Stripe platform are network-wide, so an artist
 * who sets this up here is set up everywhere. The work is `startPayoutsFor`
 * in @elkdonis/checkout — this file supplies only what IFAC alone knows:
 * who is asking, and where Stripe should return them.
 */

import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";

type SectionRow = {
  profile_sections: Record<string, unknown> | null;
  slug: string | null;
  stripe_account_id: string | null;
  stripe_onboarded_at: string | null;
  country: string | null;
};

/** Sections IFAC's public pages actually render — see api/hub/profile-sections. */
const KNOWN_SECTIONS = ["elkdonisFeed", "store", "blog"] as const;

const SECTION_LABELS: Record<(typeof KNOWN_SECTIONS)[number], { label: string; blurb: string }> = {
  elkdonisFeed: { label: "Blog feed", blurb: "Your posts from across the network, on your page." },
  store: { label: "Store", blurb: "Your work for sale, as a window onto the marketplace." },
  blog: { label: "Writing", blurb: "A shelf of what you've written here." },
};

export async function loadProfilePageAction() {
  // Any signed-in person, not only an IFAC member: whether you can be paid is
  // a personal, network-wide fact (one Stripe account, one ledger, everywhere),
  // unrelated to your role here.
  const viewer = await getViewer();
  if (!viewer) return { sections: [], payouts: null };

  const [row] = await db<SectionRow[]>`
    SELECT profile_sections, slug, stripe_account_id, stripe_onboarded_at, country
    FROM users WHERE id = ${viewer.userId} LIMIT 1
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
      href: slug ? `/artists/${slug}` : null,
    })),
    payouts: {
      // A test key is a real key: the control works, the money is not real.
      available: Boolean(process.env.STRIPE_SECRET_KEY),
      state: row?.stripe_onboarded_at
        ? ("ready" as const)
        : row?.stripe_account_id
          ? ("pending" as const)
          : ("none" as const),
      accountLabel: row?.stripe_account_id ?? null,
      country: row?.country ?? null,
      onboarding: PAYOUT_ONBOARDING_COPY,
    },
  };
}

/** Flip one optional section. Merged, never replacing the whole object. */
export async function setProfileSectionAction(
  key: string,
  on: boolean
): Promise<{ ok: true; href?: string | null } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!(KNOWN_SECTIONS as readonly string[]).includes(key)) {
    return { ok: false, error: "No such section." };
  }

  try {
    const { revalidatePath } = await import("next/cache");
    const [row] = await db<Array<{ slug: string | null }>>`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({
        [key]: on,
      } as never)}
      WHERE id = ${viewer.userId}
      RETURNING slug
    `;
    // Their public page renders from this, so it has to be rebuilt or the
    // member toggles a section on and sees no change.
    if (row?.slug) {
      for (const base of [`/artists/${row.slug}`, `/dealers/${row.slug}`]) {
        revalidatePath(base);
        revalidatePath(`${base}/writing`);
      }
    }
    return { ok: true, href: row?.slug ? `/artists/${row.slug}` : null };
  } catch (error) {
    console.error("[ifac] setProfileSectionAction:", error);
    return { ok: false, error: "Could not save that." };
  }
}

/** Begin (or resume) Stripe Express onboarding. */
export async function startPayoutsAction(
  country?: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };

  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return startPayoutsFor({
    userId: viewer.userId,
    email: viewer.email,
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3008",
    // Back into the popup they left, on the tab they left it on. The
    // serialised form is `profile:<tab>` (see cms-ui surface/url.ts); the hub
    // page re-reads Stripe when it sees ?payouts=done.
    returnPath: "/hub?surface=profile:payouts",
    country,
  });
}

/**
 * Disconnect a connected account and clear the stored country with it — the
 * only way out of an account Stripe created under the wrong one (it never
 * lets that change on an existing account).
 */
export async function disconnectPayoutsAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { disconnectPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return disconnectPayoutsFor(viewer.userId);
}
