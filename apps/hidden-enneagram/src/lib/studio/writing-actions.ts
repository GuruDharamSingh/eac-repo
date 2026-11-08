"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug, getOrgFeed, listActingIdentities } from "@elkdonis/services";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { renderEssayHtml, type EssayDoc, type ThreadCardAttrs } from "@elkdonis/utils/essay";
import type {
  StudioIdentity,
  StudioListing,
  StudioPatch,
  StudioPiece,
  StudioPieceSummary,
  StudioResult,
} from "@elkdonis/studio";
import { getApiEditor } from "@/lib/auth";
import { deleteContentAction } from "@/lib/cms/actions";
import { slugifyTitle } from "@/lib/cms/schema";
import { siteConfig } from "@/config/site";

// ============================================================================
// The Studio's Writing kind, on Ario's site (round 4, 2026-11-07).
//
// arts-collective's lib/studio-actions.ts is the model, with ONE change of
// target: there a piece is a network `writing` thread homed on the directory
// (`oad`) and listed on the org; here it is one of this site's own posts
// (threads.kind = 'post', org = hidden-enneagram, in a feed), because that is
// what /writing and every shelf on this site read. A byte-identical copy would
// make pieces this site never shows.
//
// So the columns are this site's: body (sanitised HTML; from the canvas doc
// when there is one, the way updateWritingPost renders it), excerpt, section,
// metadata.coverImageUrl/layout/series/byline/seo. Authorisation is the
// /manage rule (owner or guide of this org), re-checked in every action:
// getApiEditor returns null instead of redirecting, so the Studio gets an
// error it can show rather than a navigation.
// ============================================================================

const ORG = siteConfig.orgId;
const DEFAULT_FEED = "writing";
const FEED_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Row = {
  id: string;
  author_id: string;
  org_id: string;
  slug: string;
  section: string | null;
  title: string;
  excerpt: string | null;
  body: string | null;
  body_doc: EssayDoc | null;
  body_format: string | null;
  status: string;
  cover_image_url: string | null;
  layout: string | null;
  series: string | null;
  byline: { userId?: unknown; name?: unknown } | null;
  seo: { title?: unknown; description?: unknown; imageUrl?: unknown; noindex?: unknown } | null;
  published_at: Date | string | null;
  updated_at: Date | string;
};

const COLS = db`
  t.id, t.author_id, t.org_id, t.slug, t.section, t.title, t.excerpt, t.body, t.body_doc, t.body_format, t.status,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.metadata->>'layout' AS layout,
  t.metadata->>'series' AS series,
  t.metadata->'byline' AS byline,
  t.metadata->'seo' AS seo,
  t.published_at, t.updated_at
`;

const LAYOUTS = ["essay", "feature", "note", "announcement", "document"] as const;
const iso = (v: Date | string | null): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : v);

function minutes(html: string | null): number | null {
  const chars = (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
  const m = Math.ceil(chars / 5 / 230);
  return chars && m >= 2 ? m : null;
}

function toPiece(r: Row): StudioPiece {
  const seo = r.seo && typeof r.seo === "object" ? r.seo : null;
  return {
    id: r.id,
    authorId: r.author_id,
    orgId: r.org_id,
    slug: r.slug,
    title: r.title,
    lede: r.excerpt,
    bodyHtml: sanitizeRichText(r.body ?? ""),
    bodyDoc: r.body_format === "doc" && r.body_doc && typeof r.body_doc === "object" ? r.body_doc : null,
    bodyFormat: r.body_format === "doc" ? "doc" : "html",
    layout: (LAYOUTS as readonly string[]).includes(r.layout ?? "") ? (r.layout as StudioPiece["layout"]) : null,
    series: r.series?.trim() || null,
    byline:
      r.byline && typeof r.byline.userId === "string" && typeof r.byline.name === "string"
        ? { userId: r.byline.userId, name: r.byline.name }
        : null,
    seo: seo
      ? {
          title: typeof seo.title === "string" ? seo.title : null,
          description: typeof seo.description === "string" ? seo.description : null,
          imageUrl: typeof seo.imageUrl === "string" ? seo.imageUrl : null,
          noindex: seo.noindex === true,
        }
      : null,
    coverImageUrl: r.cover_image_url,
    status: r.status === "published" ? "published" : "draft",
    publishedAt: iso(r.published_at),
    updatedAt: iso(r.updated_at) ?? new Date().toISOString(),
    readingMinutes: minutes(r.body),
    shares: [],
  };
}

async function readPost(id: string): Promise<Row | null> {
  const rows = await db<Row[]>`
    SELECT ${COLS} FROM threads t
    WHERE t.id = ${id} AND t.org_id = ${ORG} AND t.kind = 'post' AND t.status <> 'archived'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function revalidatePost(section: string | null, slug: string) {
  revalidatePath("/");
  revalidatePath("/manage");
  if (section) {
    revalidatePath(`/${section}`);
    revalidatePath(`/${section}/${slug}`);
  }
}

const notHere = "Pieces made on this site belong to The Hidden Enneagram: choose it under “Writing as”.";

export async function listPublishPieces(orgId: string | null): Promise<StudioPieceSummary[]> {
  if (!(await getApiEditor()) || orgId !== ORG) return [];
  const rows = await db<Row[]>`
    SELECT ${COLS} FROM threads t
    WHERE t.org_id = ${ORG} AND t.kind = 'post' AND t.status <> 'archived'
    ORDER BY t.updated_at DESC
    LIMIT 200
  `;
  return rows.map(toPiece).map(({ id, slug, title, lede, coverImageUrl, status, publishedAt, updatedAt, readingMinutes, series }) => ({
    id, slug, title, lede, coverImageUrl, status, publishedAt, updatedAt, readingMinutes, series,
  }));
}

export async function loadPublishPiece(id: string): Promise<{ post: StudioPiece; listing: StudioListing } | null> {
  if (!(await getApiEditor())) return null;
  const row = await readPost(id);
  if (!row) return null;
  return {
    post: toPiece(row),
    // One home and nowhere else: a post of this site shows on this site.
    listing: { orgs: [{ orgId: ORG, name: siteConfig.orgName }], selected: [ORG], homeOrgId: ORG },
  };
}

/** `feed` is the page it goes on (the popup's ?feed=); /writing unless one is named. */
export async function startPublishPiece(orgId: string, title: string, feed?: string | null): Promise<StudioResult<{ id: string }>> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Sign in as an editor of this site." };
  if (orgId !== ORG) return { ok: false, error: notHere };
  const clean = title.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "A piece needs a title." };
  const section = feed && FEED_SLUG.test(feed) ? feed : DEFAULT_FEED;
  if (!(await getOrgFeed(ORG, section))) return { ok: false, error: `This site has no “${section}” page.` };
  const id = nanoid(21);
  const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(clean));
  try {
    await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, section, title, slug, body, excerpt,
        status, visibility, metadata, is_rsvp_enabled, published_at
      ) VALUES (
        ${id}, ${ORG}, ${editor.userId}, 'post', ${section},
        ${clean}, ${slug}, NULL, NULL,
        'draft', 'PUBLIC', ${db.json({})}, FALSE, NULL
      )
    `;
  } catch (err) {
    console.error("[hidden-enneagram] startPublishPiece:", err);
    return { ok: false, error: "Could not start that piece." };
  }
  revalidatePath("/manage");
  return { ok: true, value: { id } };
}

export async function savePublishPiece(id: string, patch: StudioPatch): Promise<StudioResult<StudioPiece>> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Sign in as an editor of this site." };
  const existing = await readPost(id);
  if (!existing) return { ok: false, error: "That piece no longer exists." };

  const title = patch.title?.trim().slice(0, 200);
  if (title !== undefined && !title) return { ok: false, error: "A piece needs a title." };

  let byline: { userId: string; name: string } | null | undefined;
  if (patch.bylineId !== undefined) {
    if (patch.bylineId === null || patch.bylineId === editor.userId) byline = null;
    else {
      const mine = (await listActingIdentities(editor.userId)).find((i) => i.id === patch.bylineId && !i.retiredAt);
      if (!mine) return { ok: false, error: "That name is not one of yours." };
      byline = { userId: mine.id, name: mine.displayName.slice(0, 120) };
    }
  }

  const fromDoc = patch.bodyDoc !== undefined;
  const body = fromDoc
    ? sanitizeRichText(renderEssayHtml(patch.bodyDoc as EssayDoc))
    : patch.bodyHtml === undefined
      ? undefined
      : sanitizeRichText(patch.bodyHtml);
  let lede = patch.lede === undefined ? undefined : patch.lede?.trim().slice(0, 280) || null;
  if (lede === null && body !== undefined) lede = deriveExcerpt(body) || null;
  if (lede === undefined && body !== undefined && !existing.excerpt) lede = deriveExcerpt(body) || null;

  const slug =
    existing.status === "draft" && title !== undefined && title !== existing.title
      ? await ensureUniqueThreadSlug(ORG, slugifyTitle(title), id)
      : existing.slug;
  const meta: Record<string, unknown> = {};
  if (patch.coverImageUrl !== undefined) meta.coverImageUrl = patch.coverImageUrl?.trim().slice(0, 500) || null;
  if (patch.layout !== undefined) meta.layout = patch.layout;
  if (patch.series !== undefined) meta.series = patch.series?.trim().slice(0, 120) || null;
  if (byline !== undefined) meta.byline = byline;
  if (patch.seo !== undefined) {
    meta.seo = patch.seo
      ? {
          title: patch.seo.title?.trim().slice(0, 160) || null,
          description: patch.seo.description?.trim().slice(0, 320) || null,
          imageUrl: patch.seo.imageUrl?.trim().slice(0, 500) || null,
          noindex: patch.seo.noindex === true,
        }
      : null;
  }
  const publishing = patch.status === "published" && !existing.published_at;

  try {
    await db`
      UPDATE threads SET
        title = ${title ?? existing.title},
        slug = ${slug},
        ${lede !== undefined ? db`excerpt = ${lede},` : db``}
        ${body !== undefined
          ? fromDoc
            ? db`body = ${body}, body_doc = ${db.json(patch.bodyDoc as never)}, body_format = 'doc',`
            : db`body = ${body}, body_doc = NULL, body_format = 'html',`
          : db``}
        ${Object.keys(meta).length ? db`metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json(meta as never)},` : db``}
        ${patch.status !== undefined ? db`status = ${patch.status},` : db``}
        ${publishing ? db`published_at = NOW(),` : db``}
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${ORG} AND kind = 'post'
    `;
  } catch (err) {
    console.error("[hidden-enneagram] savePublishPiece:", err);
    return { ok: false, error: "Could not save that." };
  }
  const saved = await readPost(id);
  if (!saved) return { ok: false, error: "Could not read the piece back." };
  revalidatePost(saved.section, saved.slug);
  return { ok: true, value: toPiece(saved) };
}

/** The site's own delete (/manage's), so a removed piece leaves the same way everywhere. */
export async function removePublishPiece(id: string): Promise<StudioResult> {
  if (!(await getApiEditor())) return { ok: false, error: "Sign in as an editor of this site." };
  if (!(await readPost(id))) return { ok: false, error: "That piece no longer exists." };
  const res = await deleteContentAction(id);
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Could not remove that piece." };
}

export async function setPublishListing(id: string, orgIds: string[]): Promise<StudioResult> {
  if (!(await getApiEditor())) return { ok: false, error: "Sign in as an editor of this site." };
  return orgIds.includes(ORG) ? { ok: true } : { ok: false, error: "A piece made here always shows on this site." };
}

export async function listPublishIdentities(): Promise<StudioIdentity[]> {
  const editor = await getApiEditor();
  if (!editor) return [];
  const all = await listActingIdentities(editor.userId);
  return all.filter((i) => !i.retiredAt).map((i) => ({ id: i.id, name: i.displayName, relation: i.relation }));
}

export async function listPublishSeries(): Promise<Array<{ name: string; count: number }>> {
  if (!(await getApiEditor())) return [];
  const rows = await db<Array<{ name: string; count: number }>>`
    SELECT TRIM(metadata->>'series') AS name, COUNT(*)::int AS count
    FROM threads
    WHERE org_id = ${ORG} AND kind = 'post' AND status <> 'archived' AND COALESCE(TRIM(metadata->>'series'), '') <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 50
  `;
  return rows;
}

/** The canvas's card picker: this site's own published posts and services, by title. */
export async function searchPublishThreads(kind: string, q: string): Promise<Array<Omit<ThreadCardAttrs, "view">>> {
  if (!(await getApiEditor())) return [];
  const kinds = kind === "service" ? ["service"] : kind === "writing" || kind === "post" ? ["post"] : [];
  if (!kinds.length) return [];
  const needle = `%${q.trim().replace(/[%_]/g, "")}%`;
  const rows = await db<Array<{ id: string; kind: string; section: string | null; slug: string; title: string; cover: string | null }>>`
    SELECT t.id, t.kind, t.section, t.slug, t.title, t.metadata->>'coverImageUrl' AS cover
    FROM threads t
    WHERE t.org_id = ${ORG} AND t.status = 'published' AND t.kind = ANY(${kinds})
      AND (${q.trim() === ""} OR t.title ILIKE ${needle})
    ORDER BY COALESCE(t.published_at, t.updated_at) DESC
    LIMIT 12
  `.catch((err) => {
    console.error("[hidden-enneagram] searchPublishThreads:", err);
    return [];
  });
  return rows.map((r) => ({
    threadId: r.id,
    kind: r.kind === "post" ? "writing" : r.kind,
    title: r.title,
    meta: null,
    href: r.kind === "service" ? `/services/${r.slug}` : `/${r.section ?? DEFAULT_FEED}/${r.slug}`,
    coverImageUrl: r.cover,
    price: null,
    forSale: false,
  }));
}
