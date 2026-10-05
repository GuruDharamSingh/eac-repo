"use server";

import {
  canEditProfile,
  createWritingPost,
  deleteWritingPost,
  getWritingPostById,
  listListableOrgs,
  listThreadListings,
  listWriting,
  listWritingSeries,
  listActingIdentities,
  setThreadListings,
  updateWritingPost,
  type WritingPost,
} from "@elkdonis/services";
import type {
  StudioIdentity,
  StudioListing,
  StudioPatch,
  StudioPiece,
  StudioPieceSummary,
  StudioResult,
} from "@elkdonis/studio";
import { db } from "@elkdonis/db";
import type { ThreadCardAttrs } from "@elkdonis/utils/essay";
import { getCurrentUser } from "@/lib/session";
import { getOrgHomeUrl } from "@/lib/org-url";

/**
 * The Studio's writes, on arts-collective (docs/open/STUDIO_BRIEF_2026-09-27.md).
 *
 * Same rule as IFAC's writing-actions.ts: the AUTHOR (or a global admin) may
 * change a piece — canEditProfile(viewer, post.authorId), the author read from
 * the row, never from the request. Every action re-reads the piece by id.
 * Pieces render on the org sites and the directory, not here, so there is
 * nothing to revalidate in this app.
 */

const PERSONAL_ORG_ID = "oad";

async function viewerId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

async function authorizePost(postId: string) {
  const viewer = await viewerId();
  if (!viewer) return { ok: false as const, error: "Sign in required." };
  const post = await getWritingPostById(postId);
  if (!post) return { ok: false as const, error: "That piece no longer exists." };
  if (!(await canEditProfile(viewer, post.authorId))) {
    return { ok: false as const, error: "Not authorized." };
  }
  return { ok: true as const, post, viewer };
}

function toPiece(p: WritingPost): StudioPiece {
  return {
    id: p.id,
    authorId: p.authorId,
    orgId: p.orgId,
    slug: p.slug,
    title: p.title,
    lede: p.lede,
    bodyHtml: p.bodyHtml,
    bodyDoc: p.bodyDoc,
    bodyFormat: p.bodyFormat,
    layout: p.layout,
    series: p.series,
    byline: p.byline,
    seo: p.seo,
    coverImageUrl: p.coverImageUrl,
    status: p.status,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    readingMinutes: p.readingMinutes,
  };
}

export async function listStudioPieces(orgId: string | null): Promise<StudioPieceSummary[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  return listWriting(viewer, { orgId: orgId ?? undefined, includeDrafts: true, limit: 200 });
}

export async function listStudioIdentities(): Promise<StudioIdentity[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const all = await listActingIdentities(viewer);
  return all.filter((i) => !i.retiredAt).map((i) => ({ id: i.id, name: i.displayName, relation: i.relation }));
}

export async function listStudioSeries(): Promise<Array<{ name: string; count: number }>> {
  const viewer = await viewerId();
  if (!viewer) return [];
  return listWritingSeries(viewer);
}

export async function loadStudioPiece(
  id: string
): Promise<{ post: StudioPiece; listing: StudioListing } | null> {
  const auth = await authorizePost(id);
  if (!auth.ok) return null;
  const [orgs, selected] = await Promise.all([listListableOrgs(auth.viewer), listThreadListings(id)]);
  return {
    post: toPiece(auth.post),
    listing: {
      orgs: orgs.map((o) => ({ orgId: o.orgId, name: o.name })),
      selected,
      homeOrgId: auth.post.orgId,
    },
  };
}

/**
 * Start a piece under the acting org. `oad` ("Just me") homes it on the
 * directory with no listing; an org homes it on the directory too and lists
 * it there when the author is a member (createWritingPost decides).
 */
export async function startStudioPiece(orgId: string, title: string): Promise<StudioResult<{ id: string }>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  const clean = title.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "A piece needs a title." };
  const target = orgId && orgId !== PERSONAL_ORG_ID ? orgId : PERSONAL_ORG_ID;
  if (target !== PERSONAL_ORG_ID) {
    const allowed = (await listListableOrgs(viewer)).some((o) => o.orgId === target);
    if (!allowed) return { ok: false, error: "You are not a member of that organisation." };
  }
  const result = await createWritingPost({ authorId: viewer, orgId: target, title: clean });
  if (result.ok === false) return { ok: false, error: result.error };
  return { ok: true, value: { id: result.post.id } };
}

export async function saveStudioPiece(id: string, patch: StudioPatch): Promise<StudioResult<StudioPiece>> {
  const auth = await authorizePost(id);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { bylineId, ...rest } = patch;
  const input: Parameters<typeof updateWritingPost>[1] = { ...rest };
  if (bylineId !== undefined) {
    // Only an identity this account holds may sign its work.
    if (bylineId === null || bylineId === auth.viewer) {
      input.byline = null;
    } else {
      const mine = (await listActingIdentities(auth.viewer)).find((i) => i.id === bylineId && !i.retiredAt);
      if (!mine) return { ok: false, error: "That name is not one of yours." };
      input.byline = { userId: mine.id, name: mine.displayName };
    }
  }
  const result = await updateWritingPost(id, input);
  if (result.ok === false) return { ok: false, error: result.error };
  return { ok: true, value: toPiece(result.post) };
}

export async function removeStudioPiece(id: string): Promise<StudioResult> {
  const auth = await authorizePost(id);
  if (!auth.ok) return { ok: false, error: auth.error };
  const ok = await deleteWritingPost(id);
  return ok ? { ok: true } : { ok: false, error: "Could not remove that piece." };
}

export async function setStudioListing(id: string, orgIds: string[]): Promise<StudioResult> {
  const auth = await authorizePost(id);
  if (!auth.ok) return { ok: false, error: auth.error };
  const result = await setThreadListings(auth.viewer, id, orgIds.slice(0, 100));
  if (!result.ok) return { ok: false, error: result.error ?? "Could not change where this shows." };
  return { ok: true };
}

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const OFF_CARD_KINDS = ["wiki_page", "document"];
const MARKET_URL = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "").replace(/\/$/, "");

function fmtWhen(at: Date | string | null): string | null {
  if (!at) return null;
  const d = new Date(at);
  return d.toLocaleString("en-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * The canvas's card picker: the writer's own things of one kind, by title.
 * Threads for every kind but artwork; `artwork` rows (commerce) for artwork,
 * with price and for-sale state from the store (dev, 2026-09-27: artwork on
 * sale gets its own card). Only the viewer's own rows: a card is a claim
 * about something the writer made or runs.
 */
export async function searchStudioThreads(kind: string, q: string): Promise<Array<Omit<ThreadCardAttrs, "view">>> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const needle = `%${q.trim().replace(/[%_]/g, "")}%`;
  if (kind === "artwork") {
    const rows = await db<
      Array<{ id: string; org_id: string; slug: string; title: string; medium: string | null; height_cm: string | null; width_cm: string | null; status: string; cover: string | null; price: string | null; currency: string | null }>
    >`
      SELECT a.id, a.org_id, a.slug, a.title, a.medium, a.height_cm::text, a.width_cm::text, a.status,
             m.url AS cover,
             (SELECT (v.price_minor / 100.0)::text FROM artwork_variant v WHERE v.artwork_id = a.id ORDER BY v.price_minor ASC LIMIT 1) AS price,
             (SELECT v.currency FROM artwork_variant v WHERE v.artwork_id = a.id ORDER BY v.price_minor ASC LIMIT 1) AS currency
      FROM artwork a LEFT JOIN artwork_media m ON m.id = a.primary_image_id
      WHERE a.artist_user_id = ${viewer}::uuid AND a.status <> 'archived'
        AND (${q.trim() === ""} OR a.title ILIKE ${needle})
      ORDER BY a.updated_at DESC
      LIMIT 12
    `.catch((err) => {
      console.error("[studio] searchStudioThreads(artwork):", err);
      return [];
    });
    return rows.map((r) => {
      const dims = r.width_cm && r.height_cm ? `${Number(r.width_cm)} × ${Number(r.height_cm)} cm` : null;
      const meta = [r.medium, dims].filter(Boolean).join(" · ") || null;
      const forSale = r.status === "available";
      const price = r.price ? `${Number(r.price).toLocaleString("en-CA")} ${r.currency ?? ""}`.trim() : null;
      return {
        threadId: r.id,
        kind: "artwork",
        title: r.title,
        meta,
        href: `${getOrgHomeUrl({ slug: r.org_id })}/artwork/${r.slug}`,
        // artwork_media urls are the market's own /api/media paths; served from there.
        coverImageUrl: r.cover ? (r.cover.startsWith("/") && MARKET_URL ? `${MARKET_URL}${r.cover}` : r.cover) : null,
        price,
        forSale,
      };
    });
  }
  const rows = await db<
    Array<{ id: string; org_id: string; kind: string; slug: string; title: string; scheduled_at: Date | null; location: string | null; cover: string | null; published_at: Date | null; author_slug: string | null }>
  >`
    SELECT t.id, t.org_id, t.kind, t.slug, t.title, t.scheduled_at, t.location,
           t.metadata->>'coverImageUrl' AS cover, t.published_at, u.slug AS author_slug
    FROM threads t JOIN users u ON u.id = t.author_id
    WHERE t.author_id = ${viewer}::uuid AND t.status = 'published'
      AND t.kind = ${kind} AND t.kind <> ALL(${OFF_CARD_KINDS})
      AND (${q.trim() === ""} OR t.title ILIKE ${needle})
    ORDER BY COALESCE(t.scheduled_at, t.published_at) DESC
    LIMIT 12
  `.catch((err) => {
    console.error("[studio] searchStudioThreads:", err);
    return [];
  });
  return rows.map((r) => {
    const when = fmtWhen(r.scheduled_at);
    const meta = r.kind === "writing" ? (r.published_at ? fmtWhen(r.published_at)?.replace(/,.*$/, "") ?? null : null) : [when, r.location].filter(Boolean).join(" · ") || null;
    const href =
      r.kind === "writing" && r.author_slug && ARTDIRECT_URL
        ? `${ARTDIRECT_URL}/${r.author_slug}/writing/${r.slug}`
        : `${getOrgHomeUrl({ slug: r.org_id })}/${r.slug}`;
    return { threadId: r.id, kind: r.kind, title: r.title, meta, href, coverImageUrl: r.cover, price: null, forSale: false };
  });
}
