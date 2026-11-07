"use client";

import * as React from "react";
import {
  SurfaceFrame,
  SurfaceFacts,
  SurfaceSkeleton,
  useSurfaceOptional,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { SurfaceTabs, SurfaceTabPanel, usePopupData } from "@/components/surfaces/surface-tabs";
import type { PlacePopupData } from "@/components/surfaces/popup-types";
import { formatDeparture } from "@/lib/tour-format";

type Tab = "copy" | "notes" | "stats" | "assets" | "tours";

/** The descriptor a catalogue row opens. Editors only; the route 404s for anyone else. */
export function placeDescriptor(p: { id: string; title?: string }): SurfaceDescriptor {
  return { type: "custom", key: "place", title: p.title, kind: "neutral", size: "wide", props: { id: p.id } };
}

/**
 * The (private) place popup: public copy, private notes, stats, assets and
 * the tours that use it. "Open page" goes to /manage/places/[id].
 */
export function PlacePopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : null;
  const { data, error } = usePopupData<PlacePopupData>(id ? `/api/surfaces/place/${encodeURIComponent(id)}` : null);
  const [tab, setTab] = React.useState<Tab>("copy");
  const surface = useSurfaceOptional();

  if (!id || error) {
    return (
      <SurfaceFrame kind="neutral" kicker="Place" title={descriptor.title ?? "Place"}>
        <p className="text-sm text-[color:var(--sf-muted)]">{error ?? "This place could not be found."}</p>
      </SurfaceFrame>
    );
  }
  if (!data) {
    return (
      <SurfaceFrame kind="neutral" kicker="Place" title={descriptor.title ?? "Place"}>
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  const { place, usage, assets } = data;
  const s = place.stats;
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "copy", label: "Public copy" },
    { key: "notes", label: "Private notes" },
    { key: "stats", label: "Stats" },
    { key: "assets", label: assets.length ? `Assets (${assets.length})` : "Assets" },
    { key: "tours", label: usage.length ? `Tours (${usage.length})` : "Tours" },
  ];
  const actions: SurfaceAction[] = [{ label: "Open page", href: `/manage/places/${place.id}`, primary: true }];

  return (
    <SurfaceFrame
      kind="neutral"
      kicker={place.archivedAt ? "Place · archived · private" : "Place · private"}
      title={place.title}
      actions={actions}
    >
      <SurfaceTabs<Tab> id="place-popup" label="Place" tabs={tabs} current={tab} onSelect={setTab} />
      <SurfaceTabPanel id="place-popup" current={tab}>
        {tab === "copy" && (
          <>
            {place.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.imageUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
            )}
            <SurfaceFacts
              facts={[
                { label: "Address", value: place.address },
                { label: "Position", value: place.lat != null && place.lng != null ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : null },
                { label: "Tags", value: place.tags.length ? place.tags.join(", ") : null },
                { label: "Source", value: place.sourceRef ? `${place.source} (${place.sourceRef})` : place.source },
              ]}
            />
            {place.body ? (
              <div className="prose prose-sm max-w-none text-[color:var(--sf-fg)]" dangerouslySetInnerHTML={{ __html: place.body }} />
            ) : (
              <p className="text-sm text-[color:var(--sf-muted)]">No public copy yet.</p>
            )}
          </>
        )}
        {tab === "notes" &&
          (place.privateNotes ? (
            <div className="prose prose-sm max-w-none text-[color:var(--sf-fg)]" dangerouslySetInnerHTML={{ __html: place.privateNotes }} />
          ) : (
            <p className="text-sm text-[color:var(--sf-muted)]">No private notes yet.</p>
          ))}
        {tab === "stats" && (
          <SurfaceFacts
            facts={[
              { label: "Tours", value: `${s.toursCount} (${s.publishedToursCount} published)` },
              { label: "Times visited", value: String(s.runsCount) },
              { label: "Guests", value: String(s.guestsCount) },
              { label: "Last visited", value: s.lastVisitedAt ? formatDeparture(s.lastVisitedAt, { withYear: true }) : "Not yet" },
              { label: "Experiences", value: String(s.experiencesCount) },
            ]}
          />
        )}
        {tab === "assets" &&
          (assets.length === 0 ? (
            <p className="text-sm text-[color:var(--sf-muted)]">No catalogue media for this place yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {assets.map((a) => (
                <li key={a.id} className="overflow-hidden rounded border border-[color:var(--sf-line)]">
                  {a.url && (a.kind === "image" || a.kind === "still" || a.kind === "poster") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.altText ?? ""} className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs uppercase">{a.kind}</div>
                  )}
                  <p className="truncate px-1.5 py-1 text-[0.7rem] text-[color:var(--sf-muted)]">
                    {a.kind} · {a.visible ? "on" : "off"}
                  </p>
                </li>
              ))}
            </ul>
          ))}
        {tab === "tours" &&
          (usage.length === 0 ? (
            <p className="text-sm text-[color:var(--sf-muted)]">No tour stops at this place yet.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--sf-line)] rounded-md border border-[color:var(--sf-line)]">
              {usage.map((u) => (
                <li key={u.stopId} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <button
                    type="button"
                    className="text-left font-medium underline-offset-4 hover:underline"
                    onClick={() =>
                      surface?.push({ type: "custom", key: "tour", title: u.tourTitle, kind: "event", size: "wide", props: { id: u.threadId, slug: u.tourSlug, tab: "stops" } })
                    }
                  >
                    {u.tourTitle}
                  </button>
                  <span className="text-[color:var(--sf-muted)]">
                    Stop {u.position + 1}
                    {u.tourStatus !== "published" ? ` · ${u.tourStatus}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </SurfaceTabPanel>
    </SurfaceFrame>
  );
}
