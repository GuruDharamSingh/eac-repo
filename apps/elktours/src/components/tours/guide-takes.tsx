import type { GuideTake } from "@/lib/guide-takes";

/**
 * "From our guides" on the tour page (2026-11-19): each guide leading an upcoming run, with their take on the tour
 * and on its stops, beside the site's own text above. Server component; renders nothing when there are none.
 * Bodies are sanitised on save (saveTakeAction).
 */
export function GuideTakes({ takes, stops, className = "" }: { takes: GuideTake[]; stops: Array<{ id: string; title: string }>; className?: string }) {
  if (takes.length === 0) return null;
  const order = new Map(stops.map((s, i) => [s.id, i]));
  const byGuide = new Map<string, GuideTake[]>();
  for (const t of takes) byGuide.set(t.guideUserId, [...(byGuide.get(t.guideUserId) ?? []), t]);
  return (
    <section className={className} aria-labelledby="guide-takes">
      <h2 id="guide-takes" className="font-serif text-2xl">
        From our guides
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {[...byGuide.values()].map((list) => {
          const sorted = [...list].sort((a, b) => (a.stopId == null ? -1 : b.stopId == null ? 1 : (order.get(a.stopId) ?? 99) - (order.get(b.stopId) ?? 99)));
          return (
            <article key={list[0]!.guideUserId} className="border border-border p-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">With {list[0]!.guideName ?? "your guide"}</p>
              <div className="mt-3 space-y-4">
                {sorted.map((t) => (
                  <div key={t.id}>
                    {t.stopId && <h3 className="text-sm font-medium">{(order.get(t.stopId) ?? 0) + 1}. {stops.find((s) => s.id === t.stopId)?.title}</h3>}
                    {t.mediaUrl && <img src={t.mediaUrl} alt="" className="mt-2 aspect-[16/9] w-full object-cover" loading="lazy" />}
                    {t.body && <div className="prose prose-sm mt-2 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: t.body }} />}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
