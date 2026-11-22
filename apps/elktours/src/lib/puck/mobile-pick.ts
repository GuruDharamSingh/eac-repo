import { listTours, nextDepartures } from "@/lib/tours";
import { listPeople, getPerson } from "@/lib/people";
import { getPlacePublic, listPlacePhotos, listPlacesPublic } from "@/lib/places-public";
import { listExperiences } from "@/lib/experiences";
import { formatDeparture } from "@/lib/tour-format";
import type { MobileExperience, MobileGuide, MobilePlace } from "@/blocks/mobile/types";
import { discoverFor } from "./mobile-discover";

// ============================================================================
// What the phone blocks' new settings choose (2026-11-21): which favourite places and which cover, which guides and
// in what order, which experiences, which tours. Reads only, public data only (the same lists a signed-out visitor's
// page uses), each read fails soft to "nothing". Server only. A stored reference is `<kind>:<id>`; only that is stored.
// With every new setting at its default these return exactly what lib/puck/mobile-discover.ts returns, which is what
// the pixel check of the default pages proves.
// ============================================================================

const soft = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty);
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The id inside a stored reference (`place:<id>`), or a bare id. */
export function refId(v: unknown, kind: string): string {
  const s = str(v);
  return s.startsWith(kind + ":") ? s.slice(kind.length + 1) : s;
}

/** Favourite places chosen by hand: each public place, with the cover the author picked (only if it is one of that place's own pictures). */
export async function chosenPlaces(picks: unknown): Promise<MobilePlace[]> {
  const out: MobilePlace[] = [];
  for (const r of rows(picks)) {
    const id = refId(r.place, "place");
    if (!id) continue;
    const p = await soft(getPlacePublic(id), null);
    if (!p) continue; // not public, archived, another organisation's, or gone: never drawn
    let img = p.imageUrl;
    const cover = str(r.cover);
    if (cover) {
      const photos = await soft(listPlacePhotos(p.id), []);
      if (photos.some((x) => x.url === cover)) img = cover;
    }
    out.push({ id: p.id, slug: p.slug, name: p.title, kind: p.tags[0] ?? "Place", area: p.address, img });
  }
  return out;
}

type Props = Record<string, unknown>;
type Meta = Record<string, unknown> | undefined;

/** m-places-shelf: starred places (today's list) or the places chosen in the block. */
export async function shelfFor(props: Props, metadata: Meta): Promise<{ places: MobilePlace[]; placesCount: number }> {
  const d = await discoverFor(metadata);
  if (props.from === "chosen") return { places: await chosenPlaces(props.picks), placesCount: d.placesCount };
  return { places: d.places, placesCount: d.placesCount };
}

const numIn = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

/** m-guides: who is shown, in what order, with the block's own short description per person, and whether tours are listed. */
export async function guidesFor(props: Props, metadata: Meta): Promise<MobileGuide[]> {
  const limit = numIn(props.limit, 6, 1, 24);
  const listed = rows(props.people).map((r) => ({ id: refId(r.person, "guide"), blurb: str(r.blurb) })).filter((r) => r.id);
  const only = props.who === "chosen";
  const order = props.order === "name" || props.order === "listed" ? props.order : "site";
  let guides: MobileGuide[];
  if (!only && order === "site" && limit <= 6) {
    guides = (await discoverFor(metadata)).guides.slice(0, limit);
  } else {
    let cards = await soft(listPeople({ kind: "guide" }), []);
    if (only) cards = cards.filter((c) => listed.some((l) => l.id === c.userId));
    if (order === "name") cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
    if (order === "listed") {
      const at = (id: string) => { const i = listed.findIndex((l) => l.id === id); return i < 0 ? 1e6 : i; };
      cards = [...cards].sort((a, b) => at(a.userId) - at(b.userId));
    }
    guides = await Promise.all(
      cards.slice(0, limit).map(async (g) => {
        const p = props.showTours === false ? null : await soft(getPerson(g.slug), null);
        return {
          id: g.userId, slug: g.slug, name: g.name, craft: g.craft, bio: g.bio, initial: g.name.slice(0, 1).toUpperCase(), photo: g.photoUrl,
          tours: (p?.tours ?? []).map(({ tour, next: n }) => ({ slug: tour.slug, title: tour.title, sub: n ? formatDeparture(n.startsAt) : "Dates coming" })),
        };
      }),
    );
  }
  return guides.map((g) => {
    const blurb = listed.find((l) => l.id === g.id)?.blurb;
    return { ...g, bio: blurb || g.bio, tours: props.showTours === false ? [] : g.tours };
  });
}

/** m-experiences-panel: the next public experiences (today) or the ones chosen, up to `count`. */
export async function experiencesFor(props: Props, metadata: Meta): Promise<MobileExperience[]> {
  const count = numIn(props.count, 3, 1, 12);
  const wantPitch = props.mode === "description";
  const chosen = props.which === "chosen" ? rows(props.picks).map((r) => refId(r.experience, "experience")).filter(Boolean) : null;
  if (!chosen && !wantPitch) return (await discoverFor(metadata)).experiences.slice(0, count);
  const all = await soft(listExperiences(), []);
  const list = chosen ? chosen.map((id) => all.find((e) => e.id === id)).filter((e): e is (typeof all)[number] => !!e) : all;
  return list.slice(0, count).map((e) => ({
    id: e.id, slug: e.slug, title: e.title, artist: e.people[0]?.name ?? null, craft: null,
    where: e.isOnline ? "Online" : e.location ?? "By request", img: e.coverImageUrl,
    ...(wantPitch ? { pitch: e.excerpt } : {}),
  }));
}

/** The desktop landing's tour cards: which tours, how many, in what order. Plain JSON (Puck deep-copies a Date into {}). */
export async function tourCardsFor(props: Props): Promise<{ tour: unknown; next: unknown }[]> {
  const count = numIn(props.count, 6, 1, 24);
  // "dated" (the default) is the site listing as it is today: only tours with a coming date. "all" and "chosen" also take published tours without one (never a draft).
  let tours = await listTours(props.which === "all" || props.which === "chosen" ? { undated: true } : {});
  if (props.which === "chosen") {
    const ids = rows(props.picks).map((r) => refId(r.tour, "tour")).filter(Boolean);
    tours = ids.map((id) => tours.find((t) => t.id === id)).filter((t): t is (typeof tours)[number] => !!t);
  }
  const next = await nextDepartures(tours.map((t) => t.id));
  if (props.order === "title") tours = [...tours].sort((a, b) => a.title.localeCompare(b.title));
  if (props.order === "soonest") {
    const at = (id: string) => { const n = next.get(id); const t = n ? Date.parse(String(n.startsAt)) : NaN; return Number.isFinite(t) ? t : Infinity; };
    tours = [...tours].sort((a, b) => at(a.id) - at(b.id));
  }
  return JSON.parse(JSON.stringify(tours.slice(0, count).map((t) => ({ tour: t, next: next.get(t.id) ?? null }))));
}

const NO_PLACES = { places: [], tagOrder: [], favouriteCount: 0 };

/** The editor's pick lists (place, cover, guide, experience, tour): public things only. */
export async function pickSources(binds: string): Promise<{ ref: string; label: string; hint?: string }[]> {
  if (binds === "place") return [{ ref: "places", label: "Places on this site", hint: "Public places" }];
  // A cover: step one is the place, step two is one of that place's own pictures.
  if (binds === "place-photo") {
    const { places } = await soft(listPlacesPublic(), NO_PLACES);
    return places.map((p) => ({ ref: p.id, label: p.title, hint: "Choose one of its pictures" }));
  }
  if (binds === "guide") return [{ ref: "guides", label: "Guides on this site" }];
  if (binds === "experience") return [{ ref: "experiences", label: "Experiences on this site", hint: "Public" }];
  if (binds === "tour") return [{ ref: "tours", label: "Tours on this site", hint: "Published" }];
  return [];
}

export async function pickChoices(binds: string, source: string): Promise<{ value: string; label: string; hint?: string }[]> {
  if (binds === "place") {
    const { places } = await soft(listPlacesPublic(), NO_PLACES);
    return places.map((p) => ({ value: "place:" + p.id, label: p.title, hint: p.tags[0] ?? undefined }));
  }
  if (binds === "place-photo") {
    return (await soft(listPlacePhotos(source), [])).map((x, i) => ({ value: x.url, label: x.caption || "Picture " + (i + 1), hint: x.source }));
  }
  if (binds === "guide") return (await soft(listPeople({ kind: "guide" }), [])).map((g) => ({ value: "guide:" + g.userId, label: g.name, hint: g.craft ?? undefined }));
  if (binds === "experience") return (await soft(listExperiences(), [])).map((e) => ({ value: "experience:" + e.id, label: e.title }));
  if (binds === "tour") return (await soft(listTours({ undated: true }), [])).map((t) => ({ value: "tour:" + t.id, label: t.title }));
  return [];
}

/** What a stored reference names today (for the panel's one line), or null when it would draw nothing. */
export async function pickDraw(binds: string, value: string): Promise<{ label: string } | null> {
  if (binds === "place") { const p = await soft(getPlacePublic(refId(value, "place")), null); return p ? { label: p.title } : null; }
  if (binds === "place-photo") return value ? { label: "A picture of that place" } : null;
  if (binds === "guide") { const id = refId(value, "guide"); const g = (await soft(listPeople({ kind: "guide" }), [])).find((x) => x.userId === id); return g ? { label: g.name } : null; }
  if (binds === "experience") { const id = refId(value, "experience"); const e = (await soft(listExperiences(), [])).find((x) => x.id === id); return e ? { label: e.title } : null; }
  if (binds === "tour") { const id = refId(value, "tour"); const t = (await soft(listTours({ undated: true }), [])).find((x) => x.id === id); return t ? { label: t.title } : null; }
  return null;
}
