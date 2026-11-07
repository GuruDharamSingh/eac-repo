import type { CardRecord, Opened } from "@elkdonis/blocks";
import { db } from "@elkdonis/db";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { siteConfig } from "@/config/site";
import { featuredWho } from "@/lib/featured-person";
import { HOME_SLUG, listPages } from "@/lib/puck/store";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";
import { parseOpens, thenLabel } from "./opens";

// ============================================================================
// What an Opens reference and a Card's "Filled from" reference draw on Para Theater (2026-11-07), read per request.
// Server only. A thread is read only when a signed-out visitor could see it: published, PUBLIC, no `min_role`, one of
// the kinds a visitor's page shows (a gathering, a series, a piece of writing), and, for one in a feed, a public feed
// with no `min_role` (the forum gates by feed). A person needs a public profile here. Anything else draws nothing, so
// a stored reference can never show a draft, a members' thread or another org's record.
// ============================================================================

const ORG = siteConfig.orgId;
const KINDS = ["meeting", "series", "post"];

interface PublicThread { id: string; slug: string | null; title: string; kind: string; section: string | null; excerpt: string | null; cover: string | null; scheduled_at: Date | string | null }

const KIND_LABEL: Record<string, string> = { meeting: "Gathering", series: "Series", post: "Writing" };

/** Where a public thread's own page is. */
export const threadHref = (t: Pick<PublicThread, "kind" | "section" | "slug" | "id">) =>
  t.kind === "series" ? `/series/${encodeURIComponent(t.slug ?? t.id)}` : t.section ? `/${encodeURIComponent(t.section)}/${encodeURIComponent(t.slug ?? t.id)}` : null;

async function publicThreads(id?: string): Promise<PublicThread[]> {
  try {
    // A thread in a feed counts only when the feed is public with no min_role; a series has no feed.
    return await db<PublicThread[]>`
      SELECT t.id, t.slug, t.title, t.kind, t.section, t.excerpt, t.metadata->>'coverImageUrl' AS cover, t.scheduled_at
      FROM threads t
      LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
      WHERE t.org_id = ${ORG}
        AND t.status = 'published' AND t.visibility = 'PUBLIC' AND t.min_role IS NULL
        AND t.kind = ANY(${KINDS})
        AND (t.section IS NULL OR (f.is_public AND f.min_role IS NULL))
        ${id ? db`AND t.id = ${id}` : db``}
      ORDER BY t.kind, COALESCE(t.scheduled_at, t.published_at) DESC NULLS LAST
      LIMIT 200
    `;
  } catch (err) {
    console.error("[opens] threads:", err);
    return [];
  }
}

const publicThread = async (id: string) => (await publicThreads(id))[0] ?? null;

const when = (v: Date | string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
};

/** The link and popup an Opens reference draws, or null. */
export async function resolveOpens(raw: unknown): Promise<Opened | null> {
  const ref = parseOpens(raw);
  if (!ref) return null;
  if ("page" in ref) return { href: ref.page, label: ref.page };
  const p = ref.popup;
  if (p.kind === "thread") {
    const t = await publicThread(p.id);
    const href = t ? threadHref(t) : null;
    // The site's own thread popup (Surface UI's `thread` surface), not a custom one: the same popup a card opens.
    return t && href ? { href, label: `Popup: ${t.title}`, popup: { key: "thread", title: t.title, props: { id: t.id } } } : null;
  }
  const then = ref.then ? { href: ref.then, label: thenLabel(ref.then) } : null;
  const who = await featuredWho(`user:${p.userId}`);
  if (!who) return null;
  return { href: who.href ?? "/about", label: `Popup: ${who.displayName}${then ? `, then ${then.label.toLowerCase()}` : ""}`, popup: { key: "person", title: who.displayName, size: "standard", props: { who, then } } };
}

/** A Card's "Filled from": `thread:<id>` of a public gathering, series or piece of writing. */
export async function cardRecord(raw: unknown): Promise<CardRecord | null> {
  const m = typeof raw === "string" ? /^thread:([A-Za-z0-9_-]{1,21})$/.exec(raw.trim()) : null;
  if (!m) return null;
  const t = await publicThread(m[1]!);
  if (!t) return null;
  return { kind: KIND_LABEL[t.kind] ?? "Post", title: t.title, href: threadHref(t), image: t.cover, excerpt: t.excerpt, meta: t.kind === "meeting" ? when(t.scheduled_at) : null };
}

/** Step one of "From what?" for Opens and for a Card's record. */
export function opensSources(binds: string): RecordSourceItem[] {
  if (binds === "record") return [{ ref: "meeting", label: "A gathering" }, { ref: "series", label: "A series" }, { ref: "post", label: "A piece of writing" }];
  return [
    { ref: "page", label: "A page of this site", hint: "Goes there" },
    { ref: "thread", label: "Popup: a gathering, series or piece", hint: "Opens over the page" },
    { ref: "person", label: "Popup: a person", hint: "Someone with a public profile here" },
  ];
}

/** Step two. Only records a visitor can see are offered. */
export async function opensChoices(binds: string, source: string): Promise<RecordChoice[]> {
  const threads = await publicThreads();
  if (binds === "record") return threads.filter((t) => t.kind === source).map((t) => ({ value: `thread:${t.id}`, label: t.title, hint: KIND_LABEL[t.kind] }));
  if (source === "page") {
    const pages = (await listPages().catch(() => [])).filter((p) => p.slug !== HOME_SLUG && !TEMPLATE_SLUGS.has(p.slug));
    return [
      { value: "page:/", label: "Home" },
      { value: "page:/about", label: "About" },
      { value: "page:/series", label: "Series" },
      { value: "page:/publications", label: "Publications" },
      { value: "page:/community", label: "Community" },
      ...pages.map((p) => ({ value: `page:/${p.slug}`, label: `/${p.slug}`, hint: "Page builder" })),
      ...threads.flatMap((t) => { const href = threadHref(t); return href ? [{ value: `page:${href}`, label: t.title, hint: `${KIND_LABEL[t.kind]} page` }] : []; }),
    ];
  }
  if (source === "thread") return threads.map((t) => ({ value: `popup:thread:${t.id}`, label: t.title, hint: KIND_LABEL[t.kind] }));
  if (source === "person") {
    const people = await db<{ user_id: string; display_name: string; slug: string | null }[]>`
      SELECT op.user_id, u.display_name, u.slug FROM org_profiles op JOIN users u ON u.id = op.user_id
      WHERE op.org_id = ${ORG} AND op.is_public AND u.entity_type = 'person' ORDER BY op.sort_order, u.display_name
    `.catch(() => []);
    return people.flatMap((r) => [
      { value: `popup:person:${r.user_id}`, label: r.display_name },
      ...(r.slug ? [{ value: `popup:person:${r.user_id}>page:/about/${encodeURIComponent(r.slug)}`, label: `${r.display_name}, then their page`, hint: "With a button to their page" }] : []),
    ]);
  }
  return [];
}
