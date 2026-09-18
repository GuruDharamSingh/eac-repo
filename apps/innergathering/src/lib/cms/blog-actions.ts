"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

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
