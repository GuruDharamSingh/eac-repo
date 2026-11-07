import type { CardRecord, Opened } from "@elkdonis/blocks";
import { db } from "@elkdonis/db";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { siteConfig } from "@/config/site";
import { getTourBySlug, listTours } from "@/lib/tours";
import { getExperienceBySlug, listExperiences } from "@/lib/experiences";
import { formatDuration, formatPrice } from "@/lib/tour-format";
import { featuredWho } from "@/lib/featured-person";
import { listPages } from "@/lib/puck/store";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";
import { parseOpens, thenLabel } from "./opens";

// ============================================================================
// What an Opens reference and a Card's "Filled from" reference draw on this site (2026-11-06), read per request. Server
// only. A record is read only when a signed-out visitor could see it: a published, public tour or experience of
// this org, a public place of this org that is not archived, a person with a public profile here. Anything else
// draws nothing, so a stored reference can never show a draft or another org's record.
// ============================================================================

const ORG = siteConfig.orgId;

async function publicPlace(id: string): Promise<{ id: string; title: string } | null> {
  try {
    const [p] = await db<{ id: string; title: string }[]>`
      SELECT id, title FROM places WHERE id = ${id} AND org_id = ${ORG} AND is_public AND archived_at IS NULL LIMIT 1
    `;
    return p ?? null;
  } catch (err) {
    console.error("[opens] place:", err);
    return null;
  }
}

/** The link and popup an Opens reference draws, or null. */
export async function resolveOpens(raw: unknown): Promise<Opened | null> {
  const ref = parseOpens(raw);
  if (!ref) return null;
  if ("page" in ref) return { href: ref.page, label: ref.page };
  const p = ref.popup;
  const then = ref.then ? { href: ref.then, label: thenLabel(ref.then) } : null;
  if (p.kind === "tour") {
    const t = await getTourBySlug(p.id);
    return t && t.id === p.id ? { href: `/tours/${t.slug}`, label: `Popup: ${t.title}`, popup: { key: "tour", title: t.title, kind: "event", size: "wide", props: { id: t.id, slug: t.slug } } } : null;
  }
  if (p.kind === "experience") {
    const e = await getExperienceBySlug(p.id);
    return e && e.id === p.id ? { href: `/experiences/${e.slug}`, label: `Popup: ${e.title}`, popup: { key: "experience", title: e.title, kind: "service", size: "wide", props: { id: e.id, slug: e.slug } } } : null;
  }
  if (p.kind === "reviews") {
    let title: string | null = null, href = "/places";
    if (p.target === "tour") { const t = await getTourBySlug(p.id); if (t && t.id === p.id) { title = t.title; href = `/tours/${t.slug}`; } }
    else if (p.target === "experience") { const e = await getExperienceBySlug(p.id); if (e && e.id === p.id) { title = e.title; href = `/experiences/${e.slug}`; } }
    else { const pl = await publicPlace(p.id); if (pl) title = pl.title; }
    if (!title) return null;
    return { href, label: `Popup: reviews of ${title}${then ? `, then ${then.label.toLowerCase()}` : ""}`, popup: { key: "reviews", title: `Reviews of ${title}`, size: "standard", props: { type: p.target, id: p.id, title, then } } };
  }
  if (p.kind !== "person") return null;
  const who = await featuredWho(`user:${p.userId}`);
  if (!who) return null;
  return { href: who.href ?? "/about", label: `Popup: ${who.displayName}${then ? `, then ${then.label.toLowerCase()}` : ""}`, popup: { key: "person", title: who.displayName, size: "standard", props: { who, then } } };
}

/** A Card's "Filled from": `thread:<id>` of a public tour or experience. */
export async function cardRecord(raw: unknown): Promise<CardRecord | null> {
  const m = typeof raw === "string" ? /^thread:([A-Za-z0-9_-]{1,21})$/.exec(raw.trim()) : null;
  if (!m) return null;
  const t = await getTourBySlug(m[1]);
  if (t && t.id === m[1]) {
    return { kind: "Tour", title: t.title, href: `/tours/${t.slug}`, image: t.film?.poster ?? t.coverImageUrl, excerpt: t.excerpt, meta: [formatDuration(t.durationMinutes), formatPrice(t.price, t.currency)].filter(Boolean).join(" · ") || null };
  }
  const e = await getExperienceBySlug(m[1]);
  if (e && e.id === m[1]) return { kind: "Experience", title: e.title, href: `/experiences/${e.slug}`, image: e.coverImageUrl, excerpt: e.excerpt, meta: e.price != null ? formatPrice(e.price) : null };
  return null;
}

/** Step one of "From what?" for Opens and for a Card's record. */
export function opensSources(binds: string): RecordSourceItem[] {
  if (binds === "record") return [{ ref: "tour", label: "A tour" }, { ref: "experience", label: "An experience" }];
  return [
    { ref: "page", label: "A page of this site", hint: "Goes there" },
    { ref: "tour", label: "Popup: a tour", hint: "Opens over the page" },
    { ref: "experience", label: "Popup: an experience", hint: "Opens over the page" },
    { ref: "reviews", label: "Popup: reviews", hint: "Of a tour, an experience or a place" },
    { ref: "person", label: "Popup: a person", hint: "Someone with a public profile here" },
  ];
}

/** Step two. Only records a visitor can see are offered. */
export async function opensChoices(binds: string, source: string): Promise<RecordChoice[]> {
  const tours = source === "page" || source === "tour" || source === "reviews" ? await listTours() : [];
  const exps = source === "page" || source === "experience" || source === "reviews" ? await listExperiences() : [];
  if (binds === "record") {
    if (source === "tour") return tours.map((t) => ({ value: `thread:${t.id}`, label: t.title, hint: "Tour" }));
    if (source === "experience") return exps.map((e) => ({ value: `thread:${e.id}`, label: e.title, hint: "Experience" }));
    return [];
  }
  if (source === "page") {
    const pages = (await listPages()).filter((p) => !TEMPLATE_SLUGS.has(p.slug));
    return [
      { value: "page:/", label: "Home" },
      { value: "page:/tours", label: "All tours" },
      { value: "page:/places", label: "Places" },
      { value: "page:/about", label: "About" },
      ...pages.map((p) => ({ value: `page:/${p.slug}`, label: `/${p.slug}`, hint: "Page builder" })),
      ...tours.map((t) => ({ value: `page:/tours/${t.slug}`, label: t.title, hint: "Tour page" })),
      ...exps.map((e) => ({ value: `page:/experiences/${e.slug}`, label: e.title, hint: "Experience page" })),
    ];
  }
  if (source === "tour") return tours.map((t) => ({ value: `popup:tour:${t.id}`, label: t.title }));
  if (source === "experience") return exps.map((e) => ({ value: `popup:experience:${e.id}`, label: e.title }));
  if (source === "reviews") {
    let places: { id: string; title: string }[] = [];
    try {
      places = await db<{ id: string; title: string }[]>`SELECT id, title FROM places WHERE org_id = ${ORG} AND is_public AND archived_at IS NULL ORDER BY title LIMIT 200`;
    } catch (err) { console.error("[opens] places:", err); }
    return [
      ...tours.flatMap((t) => [
        { value: `popup:reviews:tour:${t.id}`, label: `Reviews of ${t.title}`, hint: "Tour" },
        { value: `popup:reviews:tour:${t.id}>page:/tours/${t.slug}`, label: `Reviews of ${t.title}, then its page`, hint: "Tour · with a button to book" },
      ]),
      ...exps.flatMap((e) => [
        { value: `popup:reviews:experience:${e.id}`, label: `Reviews of ${e.title}`, hint: "Experience" },
        { value: `popup:reviews:experience:${e.id}>page:/experiences/${e.slug}`, label: `Reviews of ${e.title}, then its page`, hint: "Experience · with a button to its page" },
      ]),
      ...places.map((p) => ({ value: `popup:reviews:place:${p.id}`, label: `Reviews of ${p.title}`, hint: "Place" })),
    ];
  }
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
