"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CataloguePlaceView } from "@/components/places/catalogue-view";
import { PlaceLinks } from "@/components/places/place-links";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { LocationCreator } from "@/components/places/location-creator";
import { PlaceBusinesses } from "@/components/places/business-card";

const PlacesMap = dynamic(() => import("@/components/places/places-map").then((m) => m.PlacesMap), {
  ssr: false,
  loading: () => <div className="h-[32rem] w-full bg-muted" />,
});

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="text-amber-600" aria-label={`${value} out of 5`}>
      {"★".repeat(full)}
      <span className="opacity-30">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/**
 * The public catalogue of places (/places): every place the tours visit, as
 * cards (photo, one line of copy, the tours it is in, links, reviews) or as
 * pins on a map. A card unfolds in place, the way a stop does in the tour
 * popup: fuller copy, links, and the reviews with their write box. Editors
 * get "Add place" (the pin/photo form from /manage/places, in a dialog).
 */
export function PlacesCatalogue({ places, canEdit }: { places: CataloguePlaceView[]; canEdit: boolean }) {
  const router = useRouter();
  const [view, setView] = React.useState<"list" | "map">("list");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const [active, setActive] = React.useState<string | null>(null);
  const dialog = React.useRef<HTMLDialogElement>(null);

  const needle = q.trim().toLowerCase();
  const shown = places.filter(
    (p) =>
      !needle ||
      p.title.toLowerCase().includes(needle) ||
      p.tags.some((t) => t.toLowerCase().includes(needle)) ||
      p.tours.some((t) => t.title.toLowerCase().includes(needle))
  );
  const mapped = shown.filter((p): p is CataloguePlaceView & { lat: number; lng: number } => p.lat != null && p.lng != null);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selected = places.find((p) => p.id === active) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search places, tags or tours"
          className="h-9 w-full max-w-xs border border-border bg-background px-2 text-sm"
          aria-label="Search places"
        />
        <div className="flex items-center gap-3">
          <div className="flex border border-border" role="group" aria-label="View">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "list" ? "Cards" : "Map"}
              </button>
            ))}
          </div>
          {canEdit && (
            <button type="button" onClick={() => dialog.current?.showModal()} className="bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Add place
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {shown.length} place{shown.length === 1 ? "" : "s"}
        {needle ? ` matching “${q.trim()}”` : ""}
      </p>

      {view === "list" ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden border border-border bg-card">
              <PlaceCard place={p} open={open.has(p.id)} onToggle={() => toggle(p.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
          <PlacesMap places={mapped} activeId={active} onSelect={setActive} className="h-[32rem] w-full" />
          <div className="border border-border bg-card md:sticky md:top-20">
            {selected ? (
              <PlaceCard place={selected} open onToggle={() => setActive(null)} closeLabel="Close" />
            ) : (
              <p className="p-5 text-sm text-muted-foreground">Pick a pin to see the place.</p>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <dialog
          ref={dialog}
          className="w-[min(40rem,calc(100vw-2rem))] border border-border bg-background p-0 text-foreground backdrop:bg-black/60"
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current?.close();
          }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-serif text-xl">Add a place</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="px-2">
              ✕
            </button>
          </div>
          <div className="p-4">
            <LocationCreator
              onCreated={({ place }) => {
                dialog.current?.close();
                router.push(`/manage/places/${place.id}`);
              }}
            />
          </div>
        </dialog>
      )}
    </div>
  );
}

function PlaceCard({ place: p, open, onToggle, closeLabel }: { place: CataloguePlaceView; open: boolean; onToggle: () => void; closeLabel?: string }) {
  return (
    <>
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" loading="lazy" className="aspect-[4/3] w-full bg-muted object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full bg-muted" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-serif text-xl leading-snug">{p.title}</h3>
        {/* What it is, from the place's current business (a bakery, a museum…), when it has one. */}
        {p.businesses[0] && (p.businesses[0].categoryLabel ?? p.businesses[0].category) ? (
          <p className="-mt-1 text-xs uppercase tracking-wider text-muted-foreground">{p.businesses[0].categoryLabel ?? p.businesses[0].category}</p>
        ) : null}
        {p.reviews && p.reviews.count > 0 && (
          <p className="text-sm">
            {p.reviews.average != null && <Stars value={p.reviews.average} />}{" "}
            <span className="text-muted-foreground">
              {p.reviews.count} review{p.reviews.count === 1 ? "" : "s"}
            </span>
          </p>
        )}
        {!open && p.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>}
        {p.tours.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">On {p.tours.length === 1 ? "the tour" : "the tours"}: </span>
            {p.tours.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/tours/${t.slug}`} className="underline underline-offset-4">
                  {t.title}
                </Link>
              </React.Fragment>
            ))}
          </p>
        )}
        {!open && <PlaceLinks links={p.links} compact />}
        <button type="button" aria-expanded={open} onClick={onToggle} className="mt-auto self-start text-sm underline underline-offset-4">
          {open ? closeLabel ?? "Less" : "More, links and reviews"}
        </button>
        {open && (
          <div className="space-y-3 border-t border-border pt-3">
            {p.body ? (
              <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: p.body }} />
            ) : p.excerpt ? (
              <p className="text-sm">{p.excerpt}</p>
            ) : null}
            {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
            <PlaceBusinesses businesses={p.businesses} compact />
            <PlaceLinks links={p.links} compact />
            <ReviewsSection target={{ type: "place", id: p.id }} title="Reviews" compact />
          </div>
        )}
      </div>
    </>
  );
}
