import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CollaborateView, type CollabCandidate } from "@/components/mobile/collaborate-view";
import { getAvailability } from "@/lib/artist-wizard";
import { getCollaborate, slotOf } from "@/lib/collaborate";
import { listExperiences } from "@/lib/experiences";
import { getTourById, listTours, loadTourFull } from "@/lib/tours";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collaborate", robots: { index: false, follow: false } };

/** Screen 36 (G7b). New route; the phone tree is the whole page. Editors only. */
export default async function CollaboratePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireOrgEditor();
  const { id } = await params;
  const base = await getTourById(id);
  if (!base) notFound();
  const [allTours, stops, tour, experiences] = await Promise.all([
    listTours({ includeDrafts: true }),
    getCollaborate(id),
    loadTourFull(base, { upcomingOnly: true }),
    listExperiences(),
  ]);
  const tours = allTours.filter((t) => viewer.role === "owner" || t.authorId === viewer.userId).map((t) => ({ id: t.id, title: t.title }));
  if (!tours.some((t) => t.id === id)) tours.unshift({ id: base.id, title: base.title });

  // getCollaborate gives a guide nothing for a tour they did not write: treat it as not found.
  if (viewer.role !== "owner" && stops.length === 0 && base.authorId !== viewer.userId) notFound();

  const deps = tour.departures.filter((d) => d.status === "scheduled" && new Date(d.startsAt) > new Date());
  const linked = new Set(stops.map((s) => s.experience?.id).filter(Boolean));

  // Free-for counts: each artist's saved cells against the arrival time at each stop, computed here once.
  const artistIds = [...new Set(experiences.map((e) => e.people.find((p) => p.role === "artist")?.userId).filter((u): u is string => Boolean(u)))];
  const avail = new Map(await Promise.all(artistIds.map(async (u) => [u, await getAvailability(u)] as const)));
  const candidates: CollabCandidate[] = experiences
    .filter((e) => e.status === "published" && e.visibility === "PUBLIC" && !linked.has(e.id))
    .map((e) => {
      const artist = e.people.find((p) => p.role === "artist");
      const a = artist ? avail.get(artist.userId) : undefined;
      const free: Record<string, number> = {};
      for (const s of stops) {
        free[s.stopId] = !a?.available
          ? 0
          : deps.filter((d) => {
              const { weekday, part } = slotOf(new Date(new Date(d.startsAt).getTime() + s.offsetMinutes * 60_000));
              return a.cells.some((c) => c.weekday === weekday && c.part === part);
            }).length;
      }
      return { id: e.id, title: e.title, artistName: artist?.name ?? null, place: e.location, free };
    });

  const view = stops.map((s) => ({
    stopId: s.stopId,
    position: s.position,
    title: s.title,
    offsetMinutes: s.offsetMinutes,
    experience: s.experience ? { id: s.experience.id, title: s.experience.title, artistName: s.experience.artistName } : null,
    dates: s.dates.map((d) => ({ departureId: d.departureId, startsAt: d.startsAt, arrivalAt: d.arrivalAt, state: d.state })),
  }));

  return (
    <div className="elk-m">
      <CollaborateView tours={tours} tourId={id} stops={view} candidates={candidates} dateCount={deps.length} />
    </div>
  );
}
