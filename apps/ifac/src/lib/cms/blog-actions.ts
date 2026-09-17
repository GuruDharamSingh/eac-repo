"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

const ORG_ID = siteConfig.orgId;

// ============================================================================
// Opting into a blog on your IFAC profile.
//
// The writing itself already exists — `threads.kind = 'writing'`, authored by
// the member, read through `@elkdonis/cms-ui/writing` — and it is opt-in via
// `users.profile_sections.blog` (migration 105's JSONB), which the Page
// sections card has toggled all along. What was missing was the door: nothing
// on the hub told a member the blog existed or what turning it on would mean.
//
// The SCOPE is the second half of that question, and it is a real one rather
// than a setting for its own sake. A member's writing lives on the network,
// not on this site — the same person publishing from another org's hub writes
// the same `kind='writing'` rows. So "everything" is not a promise about a
// future feature: `listWriting`'s `orgId` is already optional, and omitting it
// reads the author across every org they write from.
//
//   org — only pieces written here. The default, because a reader arriving
//         from IFAC expects IFAC.
//   all — everything they have written anywhere on the network.
// ============================================================================

export type BlogScope = "org" | "all";

export interface BlogState {
  enabled: boolean;
  scope: BlogScope;
  /** Where their blog lives, once it is on. Null if they have no profile. */
  href: string | null;
}

export async function getBlogStateAction(): Promise<BlogState | null> {
  const viewer = await getHubViewer();
  if (!viewer) return null;

  try {
    const [row] = await db<
      Array<{
        profile_sections: Record<string, unknown> | null;
        slug: string | null;
        tags: string[] | null;
      }>
    >`
      SELECT u.profile_sections, u.slug, op.tags
      FROM users u
      LEFT JOIN org_profiles op ON op.user_id = u.id AND op.org_id = ${ORG_ID}
      WHERE u.id = ${viewer.userId}
      LIMIT 1
    `;
    const sections = row?.profile_sections ?? {};
    const rawScope = sections.blogScope;
    return {
      enabled: Boolean(sections.blog),
      scope: rawScope === "all" ? "all" : "org",
      // Dealers and artists have different roots — hardcoding /artists is a
      // 404 for every dealer, which this hub has done before. There is no
      // `kind` column: the distinction lives in `org_profiles.tags`, which is
      // how hub-data.ts derives it too.
      href: row?.slug
        ? `/${(row.tags ?? []).includes("dealer") ? "dealers" : "artists"}/${row.slug}/writing`
        : null,
    };
  } catch (error) {
    console.error("[ifac] getBlogStateAction:", error);
    return null;
  }
}

export async function setBlogStateAction(input: {
  enabled: boolean;
  scope: BlogScope;
}): Promise<{ ok: boolean; href?: string | null; error?: string }> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };

  try {
    // Merged into the existing object, never replacing it — `profile_sections`
    // also carries `elkdonisFeed` and `store`, and writing the whole bag would
    // silently switch those off.
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
    console.error("[ifac] setBlogStateAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

/**
 * The scope a given member's blog is set to, for the public read paths.
 *
 * Not the viewer's — the PAGE OWNER's. The shelf on an artist's page shows
 * what that artist chose to show, whoever is reading it.
 *
 * Returns `undefined` for "everything", because that is what `listWriting`
 * wants for an unscoped read: its `orgId` is optional and omitting it reads
 * the author across every org they write from.
 */
export async function blogOrgScopeFor(userId: string): Promise<string | undefined> {
  try {
    const [row] = await db<Array<{ profile_sections: Record<string, unknown> | null }>>`
      SELECT profile_sections FROM users WHERE id = ${userId} LIMIT 1
    `;
    return row?.profile_sections?.blogScope === "all" ? undefined : ORG_ID;
  } catch (error) {
    // The safe default is the narrow one: showing only what was written here
    // can never surface writing the author did not mean to gather.
    console.error("[ifac] blogOrgScopeFor:", error);
    return ORG_ID;
  }
}
