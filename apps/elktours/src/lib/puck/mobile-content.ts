import { listPeople } from "@/lib/people";
import { listExperiences, listExperienceTours, getExperienceBySlug } from "@/lib/experiences";
import { listAcceptedDates } from "@/lib/collaborate";
import { formatDeparture, formatDuration } from "@/lib/tours";
import { FORMAT_LABEL } from "@/components/experiences/types";
import type { Experience } from "@/lib/catalogue-types";
import type { MobileContent, MobileExpDetail } from "@/blocks/mobile/types";

// Experiences, artists and people for the phone blocks (G4). Reads only, through Jay's modules; each fails soft.
// Server only. A page that already read it passes it as metadata.mobileContent / mobileExp.

const soft = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty);

export async function readMobileContent(): Promise<MobileContent> {
  const [people, exps] = await Promise.all([soft(listPeople({ kind: "all" }), []), soft(listExperiences(), [])]);
  const byUser = new Map(people.map((p) => [p.userId, p]));
  const experiences = await Promise.all(
    exps.map(async (e) => {
      const at = await soft(listExperienceTours(e.id, { publishedOnly: true }), []);
      const a = e.people.find((x) => x.role === "artist") ?? e.people[0];
      const mins = formatDuration(e.durationMinutes);
      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        meta: [FORMAT_LABEL[e.format as keyof typeof FORMAT_LABEL] ?? "Experience", mins].filter(Boolean).join(" · "),
        artist: a?.name ?? null,
        craft: (a && byUser.get(a.userId)?.craft) || null,
        pitch: e.excerpt,
        where: at[0] ? `At a stop on ${at[0].tourTitle}` : "By request",
        img: e.coverImageUrl,
      };
    }),
  );
  const card = (p: (typeof people)[number]) => ({ slug: p.slug, name: p.name, craft: p.craft, status: p.status, initial: p.name.slice(0, 1).toUpperCase(), photo: p.photoUrl });
  return {
    experiences,
    artists: people.filter((p) => p.isArtist).map(card),
    people: people.map((p) => ({ ...card(p), kind: p.isGuide ? ("guide" as const) : ("artist" as const), area: p.area })),
  };
}

export async function contentFor(metadata: Record<string, unknown> | undefined): Promise<MobileContent> {
  const given = metadata?.mobileContent as MobileContent | undefined;
  return given && Array.isArray(given.people) ? given : readMobileContent();
}

export async function buildMobileExp(e: Experience, viewerEmail: string | null): Promise<MobileExpDetail> {
  const [tours, dates] = await Promise.all([soft(listExperienceTours(e.id, { publishedOnly: true }), []), soft(listAcceptedDates(e.id), [])]);
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    pitch: e.excerpt,
    img: e.coverImageUrl,
    people: e.people.map((p) => ({ name: p.name, slug: p.slug, photo: p.avatarUrl })),
    facts: [
      { label: "Length", value: formatDuration(e.durationMinutes) ?? "to come" },
      { label: "Format", value: FORMAT_LABEL[e.format as keyof typeof FORMAT_LABEL] ?? "In person" },
      { label: "Where", value: e.isOnline && !e.location ? "Online" : e.location ?? "By request" },
      { label: "Group", value: "Small" },
    ],
    bodyHtml: e.body,
    tours: tours.map((t) => ({ slug: t.tourSlug, title: t.tourTitle })),
    dates: dates.map((d) => ({ id: d.departureId, label: formatDeparture(d.startsAt), tour: d.tour })),
    viewerEmail,
  };
}

/** The Studio's sample: the first published experience. */
export async function sampleMobileExp(): Promise<MobileExpDetail | null> {
  const [first] = await soft(listExperiences(), []);
  const e = first ? await soft(getExperienceBySlug(first.slug), null) : null;
  return e ? buildMobileExp(e, null) : null;
}

export async function expFor(metadata: Record<string, unknown> | undefined): Promise<MobileExpDetail | null> {
  const given = metadata?.mobileExp as MobileExpDetail | undefined;
  return given && "slug" in given ? given : sampleMobileExp();
}
