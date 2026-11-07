"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus, X } from "lucide-react";
import { Badge, Button, Input } from "@elkdonis/primitives";
import { archivePlaceAction, pickSuggestionAction, savePlaceAction } from "@/lib/place-actions";
import type { PlaceSuggestion } from "@/lib/catalogue-types";
import { PlaceSuggestions } from "@/components/places/place-suggestions";
import { PlaceDetails } from "@/components/places/place-details";
import { LinkCandidates } from "@/components/places/link-candidates";
import { LocationCreator } from "@/components/places/location-creator";
import { formatDay, type CatalogueEntry } from "@/components/places/types";

type UseFilter = "all" | "used" | "unused";

const errorText = (e: unknown) => (e instanceof Error && !/Not implemented/.test(e.message) ? e.message : "The catalogue is not ready yet.");

/**
 * The org's places, private to editors: search, filter by tag and by use,
 * and open a row in place to read its copy, notes, stats and media.
 */
export function PlaceCatalogue({ entries, linksToReview = {} }: { entries: CatalogueEntry[]; /** Doubtful links per place id. */ linksToReview?: Record<string, number> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [use, setUse] = useState<UseFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const reviewCount = Object.values(linksToReview).reduce((n, c) => n + c, 0);
  const [adding, setAdding] = useState(false);
  const [blankTitle, setBlankTitle] = useState("");

  const tags = useMemo(() => [...new Set(entries.flatMap((e) => e.place.tags))].sort((a, b) => a.localeCompare(b)), [entries]);
  const near = useMemo(() => {
    const pts = entries.filter((e) => e.place.lat != null && e.place.lng != null && !e.place.archivedAt);
    if (pts.length === 0) return null;
    return {
      lat: pts.reduce((s, e) => s + e.place.lat!, 0) / pts.length,
      lng: pts.reduce((s, e) => s + e.place.lng!, 0) / pts.length,
    };
  }, [entries]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => showArchived || !e.place.archivedAt)
      .filter((e) => !tag || e.place.tags.includes(tag))
      .filter((e) => !reviewOnly || (linksToReview[e.place.id] ?? 0) > 0)
      .filter((e) => {
        const used = (e.stats?.toursCount ?? e.tours.length) > 0;
        return use === "all" || (use === "used" ? used : !used);
      })
      .filter((e) =>
        !needle ||
        e.place.title.toLowerCase().includes(needle) ||
        (e.place.address ?? "").toLowerCase().includes(needle) ||
        e.place.tags.some((t) => t.toLowerCase().includes(needle))
      )
      .sort((a, b) => a.place.title.localeCompare(b.place.title));
  }, [entries, q, tag, use, showArchived, reviewOnly, linksToReview]);

  async function fromSuggestion(item: PlaceSuggestion) {
    if (item.placeId) return router.push(`/manage/places/${item.placeId}`);
    try {
      const r = await pickSuggestionAction(item);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.place.title} added to the catalogue`);
      router.push(`/manage/places/${r.place.id}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  function createBlank() {
    const title = blankTitle.trim();
    if (!title) return;
    start(async () => {
      try {
        const r = await savePlaceAction({ title, source: "manual" });
        if (!r.ok) return void toast.error(r.error);
        router.push(`/manage/places/${r.place.id}`);
      } catch (e) {
        toast.error(errorText(e));
      }
    });
  }

  function archive(id: string, title: string, archived: boolean) {
    if (archived && !window.confirm(`Archive “${title}”? Stops already copied from it keep their text.`)) return;
    start(async () => {
      try {
        const r = await archivePlaceAction(id, archived);
        if (!r.ok) return void toast.error(r.error);
        toast.success(archived ? "Archived" : "Restored");
        router.refresh();
      } catch (e) {
        toast.error(errorText(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Places</h2>
        <Button size="sm" variant={adding ? "outline" : "default"} onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {adding ? "Close" : "New place"}
        </Button>
      </div>

      {adding && (
        <section className="space-y-4 border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Search OpenStreetMap, or open one already in the catalogue. The new place opens for editing.
          </p>
          <PlaceSuggestions catalogue={entries.map((e) => e.place)} near={near} nearLabel="the tours' centre" onPick={fromSuggestion} />
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Or start from a name:</span>
            <Input value={blankTitle} onChange={(e) => setBlankTitle(e.target.value)} placeholder="Place name" className="max-w-xs" />
            <Button type="button" size="sm" variant="outline" disabled={pending || !blankTitle.trim()} onClick={createBlank}>Create</Button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">Or a place of your own: drop a pin on the map, or upload a photo taken there.</p>
            <LocationCreator center={near} onCreated={({ place }) => router.push(`/manage/places/${place.id}`)} />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places" className="max-w-xs" />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="h-9 border border-border bg-background px-2 text-sm"
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="flex border border-border" role="group" aria-label="Filter by use">
          {(["all", "used", "unused"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUse(u)}
              aria-pressed={use === u}
              className={`px-3 py-1.5 text-sm ${use === u ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {u === "all" ? "All" : u === "used" ? "In a tour" : "Unused"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived
        </label>
        {reviewCount > 0 && (
          <button
            type="button"
            aria-pressed={reviewOnly}
            onClick={() => setReviewOnly((v) => !v)}
            className={`border px-3 py-1.5 text-sm ${reviewOnly ? "border-primary bg-accent font-medium" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {reviewCount} link{reviewCount === 1 ? "" : "s"} to review
          </button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{shown.length} of {entries.length}</span>
      </div>

      {reviewOnly && <LinkCandidates title="Doubtful links, every place" />}

      {shown.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No places match.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {shown.map((e) => {
            const p = e.place;
            const tours = e.stats?.toursCount ?? e.tours.length;
            return (
              <li key={p.id}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-accent/30">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-10 w-14 shrink-0 border border-border object-cover" loading="lazy" />
                    ) : (
                      <span className="h-10 w-14 shrink-0 border border-dashed border-border" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.title}</span>
                      {p.archivedAt && <Badge variant="outline" className="ml-2">archived</Badge>}
                      {p.address && <span className="block truncate text-xs text-muted-foreground">{p.address}</span>}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                    </span>
                    <span className="w-20 text-right text-xs text-muted-foreground">{tours === 0 ? "unused" : `${tours} tour${tours === 1 ? "" : "s"}`}</span>
                    <span className="w-24 text-right text-xs text-muted-foreground" title="Last visited">{e.stats ? formatDay(e.stats.lastVisitedAt) : ""}</span>
                  </summary>
                  <div className="space-y-4 border-t border-border bg-card p-4">
                    <PlaceDetails entry={e} />
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/manage/places/${p.id}`}><Pencil className="size-4" aria-hidden /> Edit</Link>
                      </Button>
                      {p.archivedAt ? (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => archive(p.id, p.title, false)}>
                          <ArchiveRestore className="size-4" aria-hidden /> Restore
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => archive(p.id, p.title, true)}>
                          <Archive className="size-4" aria-hidden /> Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
