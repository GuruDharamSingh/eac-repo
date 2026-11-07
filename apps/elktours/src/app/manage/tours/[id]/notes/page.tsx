import Link from "next/link";
import { notFound } from "next/navigation";
import { listTourStops } from "@elkdonis/commerce/server";
import { getTourById } from "@/lib/tours";
import { formatDuration } from "@/lib/tour-format";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The guide's printable crib sheet: every stop's public text followed by its
 * private notes. Reached from the Stops tab; gated by the manage layout.
 */
export default async function TourNotesPage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const tour = await getTourById(id);
  if (!tour) notFound();
  const stops = await listTourStops(tour.id);

  return (
    <article className="tour-notes mx-auto max-w-3xl">
      <div className="flex items-baseline justify-between gap-3 print:hidden">
        <Link href={`/manage/tours/${tour.id}?tab=stops`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Stops</Link>
        <button type="button" className="text-sm underline underline-offset-4" data-print>
          Print
        </button>
      </div>
      <h2 className="mt-2 font-serif text-3xl">{tour.title}</h2>
      <p className="text-sm text-muted-foreground">
        Guide notes · {stops.length} stops{formatDuration(tour.durationMinutes) ? ` · ${formatDuration(tour.durationMinutes)}` : ""}
        {tour.location ? ` · meet at ${tour.location}` : ""}
      </p>
      {stops.map((s, i) => (
        <section key={s.id} className="mt-10 break-inside-avoid">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Stop {i + 1}{s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
          </p>
          <h3 className="font-serif text-2xl">{s.title}</h3>
          {s.body && <div className="mt-2 text-base leading-relaxed [&_p+p]:mt-2" dangerouslySetInnerHTML={{ __html: s.body }} />}
          {s.guideNotes ? (
            <div className="mt-4 border-l-2 border-border pl-4 text-sm leading-relaxed [&_h4]:mt-4 [&_h4]:font-semibold [&_li]:mt-1 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: s.guideNotes }} />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No guide notes yet.</p>
          )}
        </section>
      ))}
      <script dangerouslySetInnerHTML={{ __html: "document.querySelector('[data-print]')?.addEventListener('click',()=>window.print())" }} />
    </article>
  );
}
