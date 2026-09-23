"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getApiMember, getViewer } from "@/lib/auth";
import { PAYOUT_ONBOARDING_COPY as ELKDONIS_ONBOARDING } from "@elkdonis/checkout/stripe";

const ORG_ID = siteConfig.orgId;

/**
 * Opting into a blog on your member page.
 *
 * The writing already exists — `threads.kind = 'writing'`, authored by the
 * member — and the section is opt-in via `users.profile_sections.blog`. What
 * was missing was the door: nothing told a member the blog existed.
 *
 * The SCOPE is a real question, not a setting for its own sake. A member's
 * writing lives on the NETWORK, not on this site: the same person publishing
 * from another org's hub writes the same rows. `listWriting`'s `orgId` is
 * optional, so omitting it genuinely reads the author everywhere.
 */

export type BlogScope = "org" | "all";

export interface BlogState {
  enabled: boolean;
  scope: BlogScope;
  /** Where their blog lives once it is on. Null when they have no slug. */
  href: string | null;
}

export async function getBlogStateAction(): Promise<BlogState | null> {
  const viewer = await getApiMember();
  if (!viewer) return null;

  try {
    const [row] = await db<
      Array<{ profile_sections: Record<string, unknown> | null; slug: string | null }>
    >`
      SELECT profile_sections, slug FROM users WHERE id = ${viewer.userId} LIMIT 1
    `;
    const sections = row?.profile_sections ?? {};
    return {
      enabled: Boolean(sections.blog),
      scope: sections.blogScope === "all" ? "all" : "org",
      href: row?.slug ? `/artists/${row.slug}/writing` : null,
    };
  } catch (error) {
    console.error("[innergathering] getBlogStateAction:", error);
    return null;
  }
}

export async function setBlogStateAction(input: {
  enabled: boolean;
  scope: BlogScope;
}): Promise<{ ok: boolean; href?: string | null; error?: string }> {
  const viewer = await getApiMember();
  if (!viewer) return { ok: false, error: "Members only" };

  try {
    // Merged, never replaced — `profile_sections` also carries `store` and
    // `elkdonisFeed`, and writing the whole bag would switch those off.
    await db`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb)
        || jsonb_build_object(
             'blog', ${input.enabled}::boolean,
             'blogScope', ${input.scope === "all" ? "all" : "org"}::text
           )
      WHERE id = ${viewer.userId}
    `;
    revalidatePath("/hub");
    const state = await getBlogStateAction();
    return { ok: true, href: state?.href ?? null };
  } catch (error) {
    console.error("[innergathering] setBlogStateAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

/** Whether this member can list work for sale, and where that happens. */
export async function getStoreStateAction(): Promise<{
  hasStore: boolean;
  storeName: string | null;
  sectionOn: boolean;
  slug: string | null;
} | null> {
  const viewer = await getApiMember();
  if (!viewer) return null;

  try {
    const { getStoreForUser } = await import("@elkdonis/commerce/queries");
    const [row] = await db<
      Array<{ profile_sections: Record<string, unknown> | null; slug: string | null }>
    >`
      SELECT profile_sections, slug FROM users WHERE id = ${viewer.userId} LIMIT 1
    `;
    const store = await getStoreForUser(viewer.userId).catch(() => null);
    return {
      hasStore: store?.status === "active",
      storeName: store?.displayName ?? null,
      sectionOn: Boolean(row?.profile_sections?.store),
      slug: row?.slug ?? null,
    };
  } catch (error) {
    console.error("[innergathering] getStoreStateAction:", error);
    return null;
  }
}

/** Show (or hide) the "Available work" section on this member's page. */
export async function setStoreSectionAction(
  on: boolean
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getApiMember();
  if (!viewer) return { ok: false, error: "Members only" };
  try {
    await db`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb)
        || jsonb_build_object('store', ${on}::boolean)
      WHERE id = ${viewer.userId}
    `;
    revalidatePath("/hub");
    return { ok: true };
  } catch (error) {
    console.error("[innergathering] setStoreSectionAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

// ── What this person's page carries, as one answer ──────────────────────────

/**
 * The profile surface's "What your page carries" panel.
 *
 * One read for the sections and the payout state, because the panel draws
 * them together and two round trips would make it flicker.
 *
 * `store` is reported as BLOCKED rather than simply off when the person has
 * no store: the switch controls a section on their page, and showing "Turn
 * on" for a section with nothing behind it promises a shelf that would render
 * empty.
 */
/** One ledger entry, worded for the person reading it rather than the schema. */
function earningsLineLabel(line: {
  entryType: string;
  orderNumber: string | null;
  description: string | null;
  payoutMethod: string | null;
}): string {
  if (line.entryType === "payout") {
    return line.payoutMethod ? `Paid out via ${line.payoutMethod}` : "Paid out";
  }
  if (line.entryType === "refund") {
    return line.orderNumber ? `Refund — order ${line.orderNumber}` : "Refund";
  }
  if (line.description) return line.description;
  if (line.orderNumber) return `Sale — order ${line.orderNumber}`;
  return line.entryType === "adjustment" ? "Adjustment" : "Sale";
}

// The onboarding note under Getting paid (user's copy, 2026-09-20). Org-
// specific, so it lives here rather than in the shared ProfileSurface — see
// SurfaceProfilePayouts["onboarding"].

type ProfilePageWork = {
  currency: string;
  payableMinor: number;
  heldMinor: number;
  totalMinor: number;
  lines: Array<{ id: string; label: string; amountMinor: number; at: string; held: boolean }>;
} | null;

export async function loadProfilePageAction(): Promise<{
  sections: Array<{
    key: string;
    label: string;
    blurb?: string;
    on: boolean;
    blockedReason?: string | null;
    href?: string | null;
  }>;
  payouts: {
    state: "none" | "pending" | "ready";
    accountLabel?: string | null;
    available: boolean;
    /** ISO-3166 alpha-2, when already on file — see startPayoutsAction. */
    country?: string | null;
    work?: ProfilePageWork;
    onboarding?: { title: string; paragraphs: string[] } | null;
  } | null;
}> {
  // Any signed-in person, not just a member of THIS org: whether you can be
  // paid is a personal, network-wide fact (the same Stripe account and the
  // same ledger everywhere), unrelated to your role here. Gating the whole
  // popup on isMember meant a follower who already sells on another org's
  // marketplace — or is simply not yet promoted to member here — had no
  // Payouts tab at all despite a fully connected account (2026-09-20). The
  // "Writing"/"Available work" sections below stay member-only; those really
  // are about this site's own page.
  const viewer = await getViewer();
  if (!viewer) return { sections: [], payouts: null };

  const [row] = await db<
    Array<{
      profile_sections: Record<string, unknown> | null;
      slug: string | null;
      stripe_account_id: string | null;
      stripe_onboarded_at: string | null;
      country: string | null;
    }>
  >`
    SELECT profile_sections, slug, stripe_account_id, stripe_onboarded_at, country
    FROM users WHERE id = ${viewer.userId} LIMIT 1
  `;
  const sections = row?.profile_sections ?? {};
  const slug = row?.slug ?? null;

  const store = viewer.isMember
    ? await import("@elkdonis/commerce/queries").then((m) => m.getStoreForUser(viewer.userId)).catch(() => null)
    : null;

  // The ledger is network-wide (keyed on the person, not this org's store —
  // see the money model settled 2026-09-05), so this reads real sales even
  // for a member whose only store is on another host, like art-auction.
  // Fails soft: a member who has never sold anything gets `work: null` from
  // the catch below just as one whose read errored would, and the panel
  // simply omits the section rather than showing a false zero.
  let work: ProfilePageWork = null;
  try {
    const { getBalance, getEarningsStatement } = await import("@elkdonis/commerce/server");
    const party = { kind: "user" as const, userId: viewer.userId };
    const [balance, earnings] = await Promise.all([
      getBalance(party),
      getEarningsStatement(party, { limit: 8 }),
    ]);
    work = {
      currency: balance.currency,
      payableMinor: balance.payableMinor,
      heldMinor: balance.heldMinor,
      totalMinor: balance.totalMinor,
      lines: earnings.map((line) => ({
        id: line.entryId,
        label: earningsLineLabel(line),
        amountMinor: line.amountMinor,
        at: line.createdAt,
        held: line.held,
      })),
    };
  } catch (error) {
    console.error("[innergathering] loadProfilePageAction (earnings):", error);
  }

  return {
    sections: viewer.isMember
      ? [
          {
            key: "blog",
            label: "Writing",
            blurb: "A shelf of your pieces, newest first, on your member page.",
            on: Boolean(sections.blog),
            blockedReason: slug ? null : "Your account has no page address yet.",
            href: slug ? `/artists/${slug}/writing` : null,
          },
          {
            key: "store",
            label: "Available work",
            blurb: "Work you are selling, shown on your page and sold in the marketplace.",
            on: Boolean(sections.store),
            blockedReason: !slug
              ? "Your account has no page address yet."
              : !store
                ? "You have no store on the network yet — open one from Publish."
                : store.status !== "active"
                  ? "Your store is not approved yet."
                  : null,
            href: slug ? `/artists/${slug}` : null,
          },
        ]
      : [],
    payouts: {
      // A test key is a real key: the control works, the money is not real.
      available: Boolean(process.env.STRIPE_SECRET_KEY),
      state: row?.stripe_onboarded_at
        ? "ready"
        : row?.stripe_account_id
          ? "pending"
          : "none",
      accountLabel: row?.stripe_account_id ?? null,
      country: row?.country ?? null,
      work,
      onboarding: ELKDONIS_ONBOARDING,
    },
  };
}

/** Flip one optional section. Merged, never replacing the whole object. */
export async function setProfileSectionAction(
  key: string,
  on: boolean
): Promise<{ ok: true; href?: string | null } | { ok: false; error: string }> {
  const viewer = await getApiMember();
  if (!viewer) return { ok: false, error: "Members only" };
  // An allow-list, not the caller's string: `profile_sections` is a JSONB bag
  // and an arbitrary key would let a request write anything into it.
  if (!["blog", "store", "elkdonisFeed"].includes(key)) {
    return { ok: false, error: "Unknown section" };
  }

  try {
    await db`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb)
        || jsonb_build_object(${key}::text, ${on}::boolean)
      WHERE id = ${viewer.userId}
    `;
    revalidatePath("/hub");
    const [row] = await db<Array<{ slug: string | null }>>`
      SELECT slug FROM users WHERE id = ${viewer.userId}
    `;
    if (row?.slug) revalidatePath(`/artists/${row.slug}`);
    return { ok: true, href: row?.slug ? `/artists/${row.slug}` : null };
  } catch (error) {
    console.error("[innergathering] setProfileSectionAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

/**
 * Begin (or resume) Stripe Express onboarding.
 *
 * Only a PERSON connects an account — the money model makes the maker the
 * payee and an org's share a ledger balance inside the host account. The
 * heavy lifting is `startStripeOnboarding` in @elkdonis/checkout; this only
 * supplies who is asking and where Stripe should send them back.
 *
 * `country` (ISO-3166 alpha-2, from the profile surface's picker) is
 * required the first time — before an account exists — and saved BEFORE
 * onboarding starts, because that account's country is fixed at creation
 * and Stripe never changes it after. Omitting this (or, before 2026-09-20,
 * having the picker but never actually saving the choice) is why every
 * account here was created under the platform's own country regardless of
 * where its owner actually was.
 */
export async function startPayoutsAction(
  country?: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // Any signed-in person — see the note on loadProfilePageAction. Being
  // payable has nothing to do with this org's membership tier.
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };

  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return startPayoutsFor({
    userId: viewer.userId,
    email: viewer.email,
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3015",
    returnPath: "/account",
    country,
  });
}

/**
 * Disconnect a connected account and clear the stored country with it — the
 * only way out of an account Stripe created under the wrong one (it never
 * lets that change on an existing account). Clearing `country` too means
 * `startPayoutsAction` asks again on the next attempt rather than reusing
 * whatever was on file before.
 */
export async function disconnectPayoutsAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { disconnectPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return disconnectPayoutsFor(viewer.userId);
}

