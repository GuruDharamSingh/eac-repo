import type { MeetingSeries, SeriesSession } from "@elkdonis/services";
import type { StageSlide } from "../components/event-stage";
import { comingLabel, dateParts, rhythmLabel, scheduleLine, seriesZones, timeInZones } from "./series-time";
import { nextPublicSession } from "./series";

/** "Art for Non-Professionals" → ["Art for", "Non-Professionals"] (italic tail). A plain
 * hyphen: Cormorant Garamond draws U+2011 as a cross-like glyph (2026-10-10). */
export function splitTitle(title: string): [string, string | null] {
  const words = title.split(" ");
  if (words.length < 2) return [title, null];
  const n = words.length >= 5 ? 2 : 1;
  return [words.slice(0, -n).join(" "), words.slice(-n).join(" ")];
}

/** One slide of the landing's hero card for a series: its next published week, else the series itself. */
export function seriesStageSlide(
  s: MeetingSeries,
  options: { week?: SeriesSession | null; label?: string; many?: boolean; onlineLabel?: string; /** Shown to editors: the series' settings in the planner. */ editHref?: string | null } = {}
): StageSlide {
  const week = options.week === undefined ? nextPublicSession(s) : options.week;
  const { zone, zones } = seriesZones(s);
  const pres = s.presentation ?? {};
  const [head, em] = splitTitle(s.title);
  const href = `/series/${s.slug}`;
  const eyebrow = options.many ? "Series" : "Current series";
  const edit = options.editHref ? [{ label: "Edit series", href: options.editHref }] : [];
  if (!week) {
    return {
      kind: "Series",
      eyebrow,
      title: head,
      titleEm: em,
      lede: pres.lede ?? s.excerpt ?? null,
      facts: s.scheduledAt
        ? [
            { icon: "calendar", text: scheduleLine(s, s.scheduledAt, zone) },
            { icon: "clock", text: timeInZones(s.scheduledAt, zones) },
          ]
        : [],
      actions: [{ label: "About the series", href, primary: true }, ...edit],
      imageUrl: s.coverImageUrl ?? null,
      imageFrame: s.cover?.kind === "image" ? s.cover.frame ?? null : null,
    };
  }
  const label = options.label ?? comingLabel(week);
  const d = dateParts(week.at, zone);
  return {
    kind: `${rhythmLabel(s)} series`,
    eyebrow,
    title: head,
    titleEm: em,
    lede: pres.lede ?? s.excerpt ?? null,
    facts: [
      { icon: "calendar", text: `${label} · ${d.long}` },
      { icon: "clock", text: timeInZones(week.at, zones) },
      { icon: "video", text: s.format === "in_person" ? s.location ?? "In person" : options.onlineLabel ?? "Online" },
    ],
    // One call to action (2026-10-10): the series page, from its top.
    actions: [{ label: "See all sessions", href, primary: true }, ...edit],
    imageUrl: week.coverStillUrl ?? s.coverImageUrl ?? null,
    imageFrame: week.coverStillUrl ? week.coverFrame : s.cover?.kind === "image" ? s.cover.frame ?? null : null,
    tag: `${label} · ${d.weekday} ${d.day} ${d.month}`,
    caption: {
      title: week.title ?? "To be announced",
      sub: `Session ${week.number}${week.host?.displayName ? ` · hosted by ${week.host.displayName}` : ""}`,
    },
  };
}
