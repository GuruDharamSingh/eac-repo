// The tour adapter: today's tour page data -> the neutral StageModel, and back to the props the phone index draws today
// (IndexModel from components/tours/stage/phone/index/data.ts buildModel). STAGE lane, 2026-11-21.
//
// Nothing here imports a component. `tourToStageModel` re-derives every field from TourPageData using the tour vocabulary
// (it does NOT call buildModel), so scripts/check-stage-model.mts can prove the two agree byte for byte, which in turn
// proves the vocabulary table holds the exact words the stage draws now. Server and client safe (pure functions).

import type { TourPageData } from "@/blocks/tour/context";
import type { StageStopData, StagePlace, StageTake } from "@/components/tours/stage/types";
import type { DepRow, IndexModel, SectionId } from "@/components/tours/stage/phone/index/data";
import { formatDuration, formatPrice, formatWallDate, formatWallTime, wallClock } from "@/lib/tour-format";
import type { StageCard, StageModel, StageOccasion, StageSection, StageSectionId, StageStep, StageVoice } from "./types";
import { countOf, vocabularyFor } from "./vocabulary";

const SECTION_TO_NEUTRAL: Record<SectionId, StageSectionId> = {
  expect: "about",
  route: "sequence",
  dates: "occasions",
  meet: "gathering",
  incl: "included",
  guide: "host",
  know: "notes",
};
const NEUTRAL_TO_SECTION = Object.fromEntries(Object.entries(SECTION_TO_NEUTRAL).map(([k, v]) => [v, k])) as Record<StageSectionId, SectionId>;

// ── small helpers (the same arithmetic the phone index uses) ──

function km(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeExtent(page: TourPageData): string | null {
  const r = page.tour.details.route;
  if (!r || r.source !== "osrm") return null;
  let total = 0;
  for (const leg of r.legs) for (let i = 1; i < leg.length; i++) total += km(leg[i - 1]!, leg[i]!);
  if (!(total > 0.05)) return null;
  return `${total < 10 ? total.toFixed(1) : Math.round(total)} km`;
}

function occasionOf(d: TourPageData["tour"]["departures"][number]): StageOccasion {
  const c = wallClock(d.startsAt);
  const parts = formatWallDate(c).split(" ");
  const full = d.seatsLeft <= 0;
  return {
    id: d.id,
    day: parts[0] ?? "",
    date: parts.slice(1).join(" "),
    time: formatWallTime(c),
    host: d.guideName,
    hostId: d.guideUserId,
    availability: full ? "Full" : `${d.seatsLeft} of ${d.capacity} left`,
    full,
    note: d.note?.trim() || null,
    label: `${formatWallDate(c)} · ${formatWallTime(c)}`,
  };
}

function cardOf(p: StagePlace): StageCard {
  return { id: p.id, slug: p.slug, title: p.title, where: p.address, summary: p.excerpt, link: p.website, links: p.links, when: p.hours, by: p.businessName, cost: p.ticket };
}
function placeOf(c: StageCard): StagePlace {
  return { id: c.id, slug: c.slug, title: c.title, address: c.where, excerpt: c.summary, website: c.link, links: c.links, hours: c.when, businessName: c.by, ticket: c.cost };
}

function voiceOf(t: StageTake): StageVoice {
  const v: StageVoice = { personName: t.guideName, body: t.body, mediaUrl: t.mediaUrl };
  if ("guideUserId" in t) v.personId = t.guideUserId;
  return v;
}
function takeOf(v: StageVoice): StageTake {
  // keys in the order the loader writes them (guideUserId, guideName, body, mediaUrl)
  return { ...("personId" in v ? { guideUserId: v.personId } : {}), guideName: v.personName, body: v.body, mediaUrl: v.mediaUrl };
}

function stepOf(s: StageStopData): StageStep {
  return {
    id: s.id,
    number: s.number,
    marker: s.numeral,
    title: s.title,
    narrative: s.narrative,
    narrativeFrom: s.narrativeFrom,
    narrativeIsFallback: s.narrativeIsFallback,
    media: { own: s.stopPhotos, related: s.placePhotos, cover: s.cover, live: s.streetView ? { kind: "streetview", ...s.streetView } : null },
    card: s.place ? cardOf(s.place) : null,
    travelToNext: s.walkMinutesToNext,
    minutes: s.durationMinutes,
    voices: s.takes.map(voiceOf),
  };
}
function stopOf(s: StageStep): StageStopData {
  let streetView: StageStopData["streetView"] = null;
  if (s.media.live) {
    const { lat, lng, heading, pitch, fov, stillUrl } = s.media.live;
    streetView = { lat, lng, heading, pitch, fov, stillUrl };
  }
  return {
    id: s.id,
    number: s.number,
    numeral: s.marker,
    title: s.title,
    narrative: s.narrative,
    narrativeFrom: s.narrativeFrom,
    narrativeIsFallback: s.narrativeIsFallback,
    stopPhotos: s.media.own,
    placePhotos: s.media.related,
    cover: s.media.cover,
    streetView,
    place: s.card ? placeOf(s.card) : null,
    walkMinutesToNext: s.travelToNext,
    takes: s.voices.map(takeOf),
    durationMinutes: s.minutes,
  };
}

// ── forward: the tour page -> the neutral model ──

/** Null where the page has no stage data (as buildModel). `chosenId` and `now` are the same two inputs buildModel takes. */
export function tourToStageModel(page: TourPageData, chosenId: string | null, now: number): StageModel | null {
  const data = page.stage;
  if (!data) return null;
  const v = vocabularyFor("tour");
  const t = page.tour;
  const steps = data.stops.map(stepOf);
  const priced = !!(t.price && t.price > 0);

  const upcoming = t.departures
    .filter((d) => d.status === "scheduled" && new Date(d.startsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const occasions = upcoming.map(occasionOf);
  const nextOpen = occasions.find((d) => !d.full) ?? null;
  const chosen = chosenId ? occasions.find((d) => d.id === chosenId && !d.full) ?? null : null;
  const selected = chosen ?? nextOpen;
  const more = selected ? occasions.filter((d) => d.id !== selected.id).length : 0;

  const dur = formatDuration(t.durationMinutes);
  const extent = routeExtent(page);
  const group = page.maxParty > 0 ? `≤ ${page.maxParty}` : null;
  const priceLabel = priced ? formatPrice(t.price, t.currency) : "";
  const headlineFacts: [string, string][] = [];
  if (dur) headlineFacts.push(["Length", dur]);
  if (extent) headlineFacts.push(["Walk", extent]);
  if (group) headlineFacts.push(["Group", group]);
  if (priced) headlineFacts.push(["Price", priceLabel]);

  const aboutFacts: [string, string][] = [];
  if (t.details.effort) aboutFacts.push(["Pace", t.details.effort]);
  if (t.details.languages.length) aboutFacts.push(["Language", t.details.languages.join(", ")]);
  if (dur) aboutFacts.push(["Length", dur]);
  const summary = (data.tourLede ?? t.excerpt ?? "").trim() || null;
  const highlights = t.details.highlights.filter((h) => h.trim());

  const pins = data.stops.flatMap((s) => {
    const raw = t.stops.find((x) => x.id === s.id);
    return raw && raw.lat != null && raw.lng != null ? [{ id: s.id, title: s.title, lat: raw.lat, lng: raw.lng }] : [];
  });
  const mp = t.details.meetingPoint;
  const gathering = mp ? { lat: mp.lat, lng: mp.lng, label: t.location } : null;

  let gatheringHelp: StageModel["gatheringHelp"] = null;
  if (t.location || mp) {
    const dest = mp ? `${mp.lat},${mp.lng}` : encodeURIComponent(`${t.location}, ${t.details.city ?? "Paris"}`);
    gatheringHelp = {
      label: t.location ?? v.gathering.fallback,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      startLine: selected ? `Next start ${selected.label}` : null,
    };
  }

  const included = t.details.includes.filter((x) => x.trim());

  const takes = data.tourTakes.filter((x) => x.body);
  const hostName = selected?.host ?? takes[0]?.guideName ?? null;
  const take = takes.find((x) => x.guideName && x.guideName === hostName) ?? takes[0] ?? null;
  const hostId = selected?.hostId ?? take?.guideUserId ?? t.authorId ?? null;
  const hostPhoto = (hostId ? data.guidePhotos?.[hostId] : null) ?? null;
  const host: StageModel["host"] =
    hostName || take
      ? {
          name: hostName,
          photo: hostPhoto,
          sub: t.details.languages.length ? t.details.languages.join(", ") : null,
          voice: take?.body ? { body: take.body, by: take.guideName && take.guideName !== hostName ? take.guideName : null } : null,
        }
      : null;

  const notes: StageModel["notes"] = [];
  for (const d of occasions.filter((x) => x.note)) notes.push([`Note · ${d.day} ${d.date}`, { text: d.note! }]);
  const contact = t.contact?.trim() || page.contactEmail || null;
  if (contact) notes.push(["Contact", { text: contact, href: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact) ? `mailto:${contact}` : undefined }]);
  const goodToKnow = (t.goodToKnow ?? []).filter((x) => x.trim());

  const sections: StageSection[] = [];
  const add = (id: StageSectionId, teaser: string) => sections.push({ id, n: String(sections.length + 1).padStart(2, "0"), title: v.sections[id], teaser });
  if (summary || aboutFacts.length || page.fieldEditId) {
    add("about", [dur, t.details.effort, t.details.languages.join(", ") || null].filter(Boolean).join(" · ") || summary || "");
  }
  if (steps.length) add("sequence", `${countOf("tour", steps.length)}${extent ? ` · ${extent}` : ""}`);
  add("occasions", occasions.length ? v.occasions.offered(occasions.length, nextOpen?.day ?? null, nextOpen?.date ?? null) : v.occasions.none);
  if (gatheringHelp) add("gathering", t.location ?? v.gathering.teaser);
  if (included.length) add("included", included.slice(0, 3).join(", "));
  if (host) add("host", `${host.name ?? v.host.title}${host.voice ? v.host.takeSuffix : ""}`);
  if (goodToKnow.length || page.fieldEditId) add("notes", goodToKnow.length ? v.notes.points(goodToKnow.length) : v.notes.add);
  else if (notes.length) add("notes", notes.map(([k]) => k.split(" · ")[0]!.toLowerCase()).filter((x, i, a) => a.indexOf(x) === i).join(", ").replace(/^./, (c) => c.toUpperCase()));

  return {
    kind: "tour",
    steps,
    occasions,
    selectedId: selected?.id ?? null,
    selectedIsNext: !!selected && selected.id === nextOpen?.id,
    moreOccasions: more,
    action: { kind: "book", priced, priceLabel, href: null },
    headlineFacts,
    aboutFacts,
    summary,
    highlights,
    extent,
    pins,
    gathering,
    gatheringHelp,
    included,
    host,
    notes,
    goodToKnow,
    sections,
  };
}

// ── back: the neutral model -> the props the phone index draws today ──

/** What buildModel returns, rebuilt from the neutral model alone (keys in buildModel's order). */
export function stageModelToIndexModel(m: StageModel): IndexModel {
  const deps: DepRow[] = m.occasions.map((o) => ({
    id: o.id,
    day: o.day,
    date: o.date,
    time: o.time,
    guide: o.host,
    guideUserId: o.hostId,
    left: o.availability,
    full: o.full,
    note: o.note,
    label: o.label,
  }));
  const selected = deps.find((d) => d.id === m.selectedId) ?? null;
  return {
    stops: m.steps.map(stopOf),
    deps,
    selected,
    selectedIsNext: m.selectedIsNext,
    moreDates: m.moreOccasions,
    priced: m.action.priced,
    priceLabel: m.action.priceLabel,
    keyFacts: m.headlineFacts,
    expectFacts: m.aboutFacts,
    summary: m.summary,
    highlights: m.highlights,
    km: m.extent,
    mapStops: m.pins,
    meetingPoint: m.gathering,
    meet: m.gatheringHelp,
    includes: m.included,
    guide: m.host ? { name: m.host.name, photo: m.host.photo, sub: m.host.sub, take: m.host.voice } : null,
    know: m.notes,
    goodToKnow: m.goodToKnow,
    sections: m.sections.map((s) => ({ id: NEUTRAL_TO_SECTION[s.id], n: s.n, title: s.title, teaser: s.teaser })),
  };
}
