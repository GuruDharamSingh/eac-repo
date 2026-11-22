// What the phone tour page's index (4b) and sections (4c) draw, derived from the page data only: nothing here is
// invented. A section with nothing real to show is absent from `sections`, so its index row and pill vanish with it.
// INDEX, 2026-11-20.

import type { TourPageData } from "@/blocks/tour/context";
import type { StageStopData, StageTake } from "../../types";
import { formatDuration, formatPrice, formatWallDate, formatWallTime, wallClock } from "@/lib/tour-format";

export type SectionId = "expect" | "route" | "dates" | "meet" | "incl" | "guide" | "know";

export interface SectionInfo {
  id: SectionId;
  /** "01".."07", numbered over the sections that exist. */
  n: string;
  title: string;
  /** One line under the title in the index. */
  teaser: string;
}

export interface DepRow {
  id: string;
  day: string;
  date: string;
  time: string;
  guide: string | null;
  guideUserId: string | null;
  left: string;
  full: boolean;
  note: string | null;
  label: string;
}

export interface IndexModel {
  stops: StageStopData[];
  deps: DepRow[];
  /** The date the Book bar and the index face show: the chosen one, else the next with places left. */
  selected: DepRow | null;
  selectedIsNext: boolean;
  moreDates: number;
  priced: boolean;
  priceLabel: string;
  keyFacts: [string, string][];
  expectFacts: [string, string][];
  summary: string | null;
  highlights: string[];
  km: string | null;
  mapStops: { id: string; title: string; lat: number; lng: number }[];
  meetingPoint: { lat: number; lng: number; label: string | null } | null;
  meet: { label: string; directions: string; startLine: string | null } | null;
  includes: string[];
  guide: { name: string | null; photo: string | null; sub: string | null; take: { body: string; by: string | null } | null } | null;
  know: [string, { text: string; href?: string }][];
  /** The guide's "good to know" points (bullets, above the notes and the contact line). */
  goodToKnow: string[];
  sections: SectionInfo[];
}

function km(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Walked distance from the cached route (OSRM only; the straight-line fallback is not a walk). */
function routeKm(page: TourPageData): string | null {
  const r = page.tour.details.route;
  if (!r || r.source !== "osrm") return null;
  let total = 0;
  for (const leg of r.legs) for (let i = 1; i < leg.length; i++) total += km(leg[i - 1]!, leg[i]!);
  if (!(total > 0.05)) return null;
  return `${total < 10 ? total.toFixed(1) : Math.round(total)} km`;
}

function depRow(d: TourPageData["tour"]["departures"][number]): DepRow {
  const c = wallClock(d.startsAt);
  const parts = formatWallDate(c).split(" ");
  const full = d.seatsLeft <= 0;
  return {
    id: d.id,
    day: parts[0] ?? "",
    date: parts.slice(1).join(" "),
    time: formatWallTime(c),
    guide: d.guideName,
    guideUserId: d.guideUserId,
    left: full ? "Full" : `${d.seatsLeft} of ${d.capacity} left`,
    full,
    note: d.note?.trim() || null,
    label: `${formatWallDate(c)} · ${formatWallTime(c)}`,
  };
}

export function buildModel(page: TourPageData, chosenId: string | null, now: number): IndexModel | null {
  const data = page.stage;
  if (!data) return null;
  const t = page.tour;
  const stops = data.stops;
  const priced = !!(t.price && t.price > 0);

  const upcoming = t.departures
    .filter((d) => d.status === "scheduled" && new Date(d.startsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const deps = upcoming.map(depRow);
  const nextOpen = deps.find((d) => !d.full) ?? null;
  const chosen = chosenId ? deps.find((d) => d.id === chosenId && !d.full) ?? null : null;
  const selected = chosen ?? nextOpen;
  const moreDates = selected ? deps.filter((d) => d.id !== selected.id).length : 0;

  const dur = formatDuration(t.durationMinutes);
  const kmLabel = routeKm(page);
  const group = page.maxParty > 0 ? `≤ ${page.maxParty}` : null;
  const priceLabel = priced ? formatPrice(t.price, t.currency) : "";
  const keyFacts: [string, string][] = [];
  if (dur) keyFacts.push(["Length", dur]);
  if (kmLabel) keyFacts.push(["Walk", kmLabel]);
  if (group) keyFacts.push(["Group", group]);
  if (priced) keyFacts.push(["Price", priceLabel]);

  const expectFacts: [string, string][] = [];
  if (t.details.effort) expectFacts.push(["Pace", t.details.effort]);
  if (t.details.languages.length) expectFacts.push(["Language", t.details.languages.join(", ")]);
  if (dur) expectFacts.push(["Length", dur]);
  const summary = (data.tourLede ?? t.excerpt ?? "").trim() || null;
  const highlights = t.details.highlights.filter((h) => h.trim());

  const mapStops = stops.flatMap((s) => {
    const raw = t.stops.find((x) => x.id === s.id);
    return raw && raw.lat != null && raw.lng != null ? [{ id: s.id, title: s.title, lat: raw.lat, lng: raw.lng }] : [];
  });
  const mp = t.details.meetingPoint;
  const meetingPoint = mp ? { lat: mp.lat, lng: mp.lng, label: t.location } : null;

  let meet: IndexModel["meet"] = null;
  if (t.location || mp) {
    const dest = mp ? `${mp.lat},${mp.lng}` : encodeURIComponent(`${t.location}, ${t.details.city ?? "Paris"}`);
    meet = {
      label: t.location ?? "Meeting point",
      directions: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      startLine: selected ? `Next start ${selected.label}` : null,
    };
  }

  const includes = t.details.includes.filter((x) => x.trim());

  // The guide: the date in view's guide; "their take" is the tour-level take (attributed when it is someone else's).
  const takes: StageTake[] = data.tourTakes.filter((x) => x.body);
  const guideName = selected?.guide ?? takes[0]?.guideName ?? null;
  const take = takes.find((x) => x.guideName && x.guideName === guideName) ?? takes[0] ?? null;
  // The picture of the person named: the date's guide, else the take's author, else the tour's author. One id, no fallback to
  // someone else's picture under another name.
  const guideId = selected?.guideUserId ?? take?.guideUserId ?? t.authorId ?? null;
  const guidePhoto = (guideId ? data.guidePhotos?.[guideId] : null) ?? null;
  const guide: IndexModel["guide"] =
    guideName || take
      ? {
          name: guideName,
          photo: guidePhoto,
          sub: t.details.languages.length ? t.details.languages.join(", ") : null,
          take: take?.body ? { body: take.body, by: take.guideName && take.guideName !== guideName ? take.guideName : null } : null,
        }
      : null;

  const know: IndexModel["know"] = [];
  const notes = deps.filter((d) => d.note);
  for (const d of notes) know.push([`Note · ${d.day} ${d.date}`, { text: d.note! }]);
  // The contact line: the guide's own for this tour, else the office's address. A line that is an address is a mail link.
  const contact = t.contact?.trim() || page.contactEmail || null;
  if (contact) know.push(["Contact", { text: contact, href: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact) ? `mailto:${contact}` : undefined }]);
  const goodToKnow = (t.goodToKnow ?? []).filter((x) => x.trim());

  const sections: SectionInfo[] = [];
  const add = (id: SectionId, title: string, teaser: string) => sections.push({ id, n: String(sections.length + 1).padStart(2, "0"), title, teaser });

  // The guide of the tour (fieldEditId set) always gets the sections they can write into, so an empty one can be filled in place.
  if (summary || expectFacts.length || page.fieldEditId) {
    add("expect", "What to expect", [dur, t.details.effort, t.details.languages.join(", ") || null].filter(Boolean).join(" · ") || summary || "");
  }
  if (stops.length) add("route", "The route", `${stops.length} ${stops.length === 1 ? "stop" : "stops"}${kmLabel ? ` · ${kmLabel}` : ""}`);
  add(
    "dates",
    "Dates & times",
    deps.length ? `${deps.length} offered${nextOpen ? ` · next ${nextOpen.day} ${nextOpen.date}` : ""}` : "No dates open yet"
  );
  if (meet) add("meet", "Meeting point", t.location ?? "Marked on the map");
  if (includes.length) add("incl", "What's included", includes.slice(0, 3).join(", "));
  if (guide) add("guide", "Your guide", `${guide.name ?? "Your guide"}${guide.take ? " · and their take" : ""}`);
  if (goodToKnow.length || page.fieldEditId) add("know", "Good to know", goodToKnow.length ? `${goodToKnow.length} ${goodToKnow.length === 1 ? "point" : "points"}` : "Add points");
  else if (know.length) add("know", "Good to know", know.map(([k]) => k.split(" · ")[0]!.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(", ").replace(/^./, (c) => c.toUpperCase()));

  return {
    stops,
    deps,
    selected,
    selectedIsNext: !!selected && selected.id === nextOpen?.id,
    moreDates,
    priced,
    priceLabel,
    keyFacts,
    expectFacts,
    summary,
    highlights,
    km: kmLabel,
    mapStops,
    meetingPoint,
    meet,
    includes,
    guide,
    know,
    goodToKnow,
    sections,
  };
}
