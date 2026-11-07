import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@elkdonis/primitives";
import { formatDay, type CatalogueEntry } from "@/components/places/types";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { LinkCandidates } from "@/components/places/link-candidates";
import { PlaceBusinessPanel } from "@/components/places/place-business-panel";

/**
 * The read view of one place: public copy, private notes, stats, media and
 * the tours that use it. Editor-only (it shows private notes).
 */
export function PlaceDetails({ entry, showCopy = true }: { entry: CatalogueEntry; showCopy?: boolean }) {
  const { place: p, stats, assets } = entry;
  // One line per tour, even when a tour visits the place twice.
  const tours = [...new Map(entry.tours.map((u) => [u.threadId, u])).values()];
  const thumbs = assets.filter((a) => a.url && (a.kind === "image" || a.kind === "still" || a.kind === "poster"));
  const live = assets.filter((a) => !a.url);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {showCopy && (
        <div className="space-y-4">
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Public copy</h3>
            {p.body ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: p.body }} />
            ) : (
              <p className="text-sm text-muted-foreground">No copy yet.</p>
            )}
          </section>
          <section className="border border-amber-500/40 bg-amber-500/5 p-3">
            <h3 className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Lock className="size-3" aria-hidden /> Private notes
            </h3>
            {p.privateNotes ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: p.privateNotes }} />
            ) : (
              <p className="text-sm text-muted-foreground">None.</p>
            )}
          </section>
        </div>
      )}

      <div className="space-y-4">
        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Stats</h3>
          {stats ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <Stat label="Tours" value={`${stats.toursCount}${stats.publishedToursCount !== stats.toursCount ? ` (${stats.publishedToursCount} live)` : ""}`} />
              <Stat label="Runs" value={String(stats.runsCount)} />
              <Stat label="Guests" value={String(stats.guestsCount)} />
              <Stat label="Last visited" value={formatDay(stats.lastVisitedAt)} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Stats appear once the catalogue is set up.</p>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Media</h3>
          {thumbs.length === 0 && live.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {thumbs.slice(0, 8).map((a) => (
                <figure key={a.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url!} alt="" className="h-16 w-24 border border-border object-cover" loading="lazy" />
                  {!a.visible && <Badge variant="outline" className="absolute left-1 top-1 bg-background/80 text-[10px]">hidden</Badge>}
                </figure>
              ))}
              {live.map((a) => (
                <Badge key={a.id} variant="secondary">{a.kind}{a.visible ? "" : " (off)"}</Badge>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tours using it</h3>
          {tours.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not in any tour.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {tours.map((t) => (
                <li key={t.threadId} className="flex items-center gap-2">
                  <Link href={`/manage/tours/${t.threadId}/stops`} className="underline-offset-4 hover:underline">{t.tourTitle}</Link>
                  {t.tourStatus !== "published" && <Badge variant="outline">{t.tourStatus}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          {p.lat != null && p.lng != null && <>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}{p.heading != null ? ` · heading ${p.heading}°` : ""} · </>}
          {`source: ${p.source.replace("_", " ")}`}{p.sourceRef ? ` (${p.sourceRef})` : ""}
        </p>
      </div>
      {/* The shop, cafe or venue here: network listings (round 7). */}
      <div className="border-t border-border pt-4">
        <PlaceBusinessPanel placeId={p.id} placeTitle={p.title} businesses={p.businesses ?? []} />
      </div>
      {/* Links matched without confidence: hidden from visitors until approved. Renders nothing when there are none. */}
      <LinkCandidates placeId={p.id} title="Doubtful links" />
      {/* Editors see hidden reviews too, each with a Hide / Show toggle. */}
      <div className="border-t border-border pt-4">
        <ReviewsSection target={{ type: "place", id: p.id }} compact />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
