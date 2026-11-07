"use client";

import * as React from "react";
import dynamic from "next/dynamic";
// The numbered map pins (.tour-pin) are styled here, shared with the tour page.
import "@/components/tours/tour-story.css";
import {
  SurfaceFrame,
  SurfaceFacts,
  SurfaceSection,
  SurfaceSkeleton,
  useSurfaceOptional,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { SurfaceTabs, SurfaceTabPanel, usePopupData } from "@/components/surfaces/surface-tabs";
import type { TourPopupData } from "@/components/surfaces/tour-popup-types";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tour-format";
import { StopDetails } from "@/components/tours/stop-details";
import { StopAdmin } from "@/components/tours/stop-admin";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

type Tab = "overview" | "stops" | "dates";

/** The descriptor a tour card opens. `props.id` is the tour thread id. */
export function tourDescriptor(tour: { id: string; slug: string; title: string }): SurfaceDescriptor {
  return { type: "custom", key: "tour", title: tour.title, kind: "event", size: "wide", props: { id: tour.id, slug: tour.slug } };
}

/**
 * The tour popup: Overview (the visible film or poster, intro, facts),
 * Stops (in order, with the still, an excerpt and a small map; stops that
 * are an experience are badged and open it) and Dates (the next departures).
 * "Open page" goes to /tours/[slug].
 */
export function TourPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : null;
  const slug = typeof descriptor.props?.slug === "string" ? descriptor.props.slug : null;
  const { data, error } = usePopupData<TourPopupData>(id ? `/api/surfaces/tour/${encodeURIComponent(id)}` : null);
  const [tab, setTab] = React.useState<Tab>(
    // Opens on the stops, not the film (2026-11-02); a caller may still ask for a tab.
    descriptor.props?.tab === "overview" || descriptor.props?.tab === "dates" ? descriptor.props.tab : "stops"
  );
  const surface = useSurfaceOptional();

  const href = `/tours/${data?.tour.slug ?? slug ?? ""}`;
  const actions: SurfaceAction[] = [];
  if (data?.canEdit && data.tour.id) actions.push({ label: "Edit", href: `/manage/tours/${data.tour.id}`, quiet: true });
  actions.push({ label: "Open page", href, primary: !(data && !data.unavailable && data.departures.length > 0) });
  if (data && !data.unavailable && data.departures.length > 0) actions.push({ label: "Book", href: `${href}#book`, primary: true });

  if (!id || error) {
    return (
      <SurfaceFrame kind="event" kicker="Tour" title={descriptor.title ?? "Tour"} actions={slug ? [{ label: "Open page", href, primary: true }] : []}>
        <p className="text-sm text-[color:var(--sf-muted)]">{error ?? "This tour could not be found."}</p>
      </SurfaceFrame>
    );
  }

  if (!data) {
    return (
      <SurfaceFrame kind="event" kicker="Tour" title={descriptor.title ?? "Tour"}>
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  const { tour, stops, departures } = data;
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "stops", label: `Stops (${stops.length})` },
    { key: "overview", label: "Overview" },
    { key: "dates", label: departures.length ? `Dates (${departures.length})` : "Dates" },
  ];

  return (
    <SurfaceFrame
      kind="event"
      kicker={tour.status === "published" ? "Tour" : `Tour · ${tour.status}`}
      title={tour.title}
      actions={actions}
      status={data.unavailable ?? undefined}
    >
      <SurfaceTabs<Tab> id="tour-popup" label="Tour" tabs={tabs} current={tab} onSelect={setTab} />
      <SurfaceTabPanel id="tour-popup" current={tab}>
        {tab === "overview" && <Overview data={data} />}
        {tab === "stops" && (
          <Stops
            data={data}
            onExperience={(experienceId) =>
              surface?.push({ type: "custom", key: "experience", kind: "service", size: "wide", props: { id: experienceId } })
            }
          />
        )}
        {tab === "dates" && <Dates data={data} href={href} />}
      </SurfaceTabPanel>
    </SurfaceFrame>
  );
}

function Overview({ data }: { data: TourPopupData }) {
  const { tour } = data;
  const poster = tour.film?.poster ?? tour.coverImageUrl;
  return (
    <>
      {tour.film ? (
        // Always the whole 16:9 frame, never cropped: the Google credit and
        // "For promotional purposes only" are burned into the film.
        <figure className="overflow-hidden rounded-md bg-black">
          <video
            src={tour.film.url720 ?? tour.film.url}
            poster={tour.film.poster ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            controls
            className="aspect-video w-full object-contain"
          />
          <figcaption className="bg-black px-2 py-1 text-right text-[0.65rem] text-white/80">
            Map data © Google · for promotional purposes only
          </figcaption>
        </figure>
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="aspect-video w-full rounded-md object-cover" />
      ) : null}
      {tour.excerpt && <p className="text-[0.95rem] leading-relaxed">{tour.excerpt}</p>}
      <SurfaceFacts
        facts={[
          { label: "Length", value: formatDuration(tour.durationMinutes) },
          { label: "Price", value: tour.price ? formatPrice(tour.price, tour.currency) : null },
          { label: "Stops", value: data.stops.length ? String(data.stops.length) : null },
          { label: "Languages", value: tour.languages.length ? tour.languages.join(", ") : null },
          { label: "Effort", value: tour.effort },
          { label: "Group", value: tour.maxParty ? `Up to ${tour.maxParty}` : null },
          { label: "Where", value: tour.location },
        ]}
      />
      {tour.highlights.length > 0 && (
        <SurfaceSection title="Highlights">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {tour.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </SurfaceSection>
      )}
    </>
  );
}

function Stops({ data, onExperience }: { data: TourPopupData; onExperience: (id: string) => void }) {
  const [active, setActive] = React.useState(-1);
  // Which stops are open (more copy, links, reviews). Several may be open at once.
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const items = React.useRef<(HTMLLIElement | null)[]>([]);
  // Excerpts an editor just changed, shown at once in the folded rows.
  const [edited, setEdited] = React.useState<Record<string, string | null>>({});
  const mapStops = data.stops
    .filter((s): s is typeof s & { lat: number; lng: number } => s.lat != null && s.lng != null)
    .map((s) => ({ id: s.id, title: s.title, lat: s.lat, lng: s.lng }));
  if (data.stops.length === 0) {
    return <p className="text-sm text-[color:var(--sf-muted)]">The stops for this tour are being written.</p>;
  }
  const activeStopId = active >= 0 ? mapStops[active]?.id : null;

  /** A stop in the list: make it active; the map flies there. */
  const pick = (stopId: string) => {
    const m = mapStops.findIndex((x) => x.id === stopId);
    if (m >= 0) setActive(m);
  };
  /** A pin on the map: make it active and bring its row into view. */
  const pickPin = (m: number) => {
    setActive(m);
    const i = data.stops.findIndex((s) => s.id === mapStops[m]?.id);
    items.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // List on the left, the map on the right and sticky (below the tab strip) so it stays in view
  // while the list scrolls. On a phone the map comes first and also sticks under the tab strip, shorter,
  // and the stops scroll beneath it (2026-11-07; .tour-popup-map / .tour-popup-stop in tour-story.css).
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="order-2 md:order-1">
        <ol className="grid gap-3">
          {data.stops.map((s, i) => {
            const on = s.id === activeStopId;
            const mappable = s.lat != null && s.lng != null;
            return (
              <li
                key={s.id}
                ref={(el) => { items.current[i] = el; }}
                aria-current={on ? "step" : undefined}
                className={`tour-popup-stop flex gap-3 rounded-md border p-2 transition-colors ${
                  on ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-bg-soft,transparent)] shadow-[inset_3px_0_0_var(--sf-accent,currentColor)]" : "border-[color:var(--sf-line)]"
                } ${mappable ? "cursor-pointer hover:border-[color:var(--sf-fg)]" : ""}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a, button, textarea, input, form")) return;
                  if (mappable) pick(s.id);
                }}
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded bg-muted">
                  {s.stillUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.stillUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  <span
                    className={`absolute left-1 top-1 rounded-full px-1.5 text-[0.65rem] font-medium leading-4 ${
                      on ? "bg-[color:var(--sf-accent,#b45309)] text-white" : "bg-black/60 text-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium leading-snug">
                    {mappable ? (
                      <button type="button" className="text-left underline-offset-4 hover:underline" aria-pressed={on} onClick={() => pick(s.id)}>
                        {s.title}
                      </button>
                    ) : (
                      s.title
                    )}
                    {s.experienceId && (
                      <button
                        type="button"
                        onClick={() => onExperience(s.experienceId as string)}
                        className="rounded-full border border-[color:var(--sf-line)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-[color:var(--sf-muted)] hover:border-[color:var(--sf-fg)] hover:text-[color:var(--sf-fg)]"
                      >
                        Experience
                      </button>
                    )}
                    {!mappable && <span className="text-[0.65rem] uppercase tracking-wider text-[color:var(--sf-muted)]">Online</span>}
                  </p>
                  {!open.has(s.id) && (edited[s.id] ?? s.excerpt) && (
                    <p className="mt-1 line-clamp-2 text-sm text-[color:var(--sf-muted)]">{edited[s.id] ?? s.excerpt}</p>
                  )}
                  <button
                    type="button"
                    aria-expanded={open.has(s.id)}
                    onClick={() => toggle(s.id)}
                    className="mt-1 text-xs underline underline-offset-4 text-[color:var(--sf-muted)] hover:text-[color:var(--sf-fg)]"
                  >
                    {open.has(s.id) ? "Less" : s.placeId ? "More, links and reviews" : "More"}
                  </button>
                  {open.has(s.id) && (
                    <StopDetails
                      stop={s}
                      adminSlot={
                        data.canEdit ? (
                          <StopAdmin
                            stopId={s.id}
                            excerpt={edited[s.id] ?? s.excerpt}
                            onExcerpt={(x) => setEdited((m) => ({ ...m, [s.id]: x }))}
                          />
                        ) : null
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {mapStops.length > 0 && <p className="mt-2 text-[0.65rem] text-[color:var(--sf-muted)]">Stills © Google Street View</p>}
      </div>

      {mapStops.length > 0 && (
        <div className="tour-popup-map order-1 md:order-2 md:sticky md:top-14">
          <div className="tour-popup-map__frame overflow-hidden rounded-md border border-[color:var(--sf-line)] md:h-[min(60vh,28rem)]">
            <TourMap
              stops={mapStops}
              meetingPoint={data.tour.meetingPoint}
              activeIndex={active}
              onSelect={pickPin}
              className="h-full w-full"
            />
          </div>
          <p className="mt-1 text-xs text-[color:var(--sf-muted)]">
            {active >= 0 ? `${active + 1}. ${mapStops[active]?.title}` : "Pick a stop to fly to it."}
          </p>
        </div>
      )}
    </div>
  );
}

function Dates({ data, href }: { data: TourPopupData; href: string }) {
  if (data.departures.length === 0) {
    return (
      <p className="text-sm text-[color:var(--sf-muted)]">
        No dates are scheduled yet. <a className="underline underline-offset-4" href={`${href}#book`}>Ask about this tour</a>.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y divide-[color:var(--sf-line)] rounded-md border border-[color:var(--sf-line)]">
        {data.departures.map((d) => (
          <li key={d.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span>{formatDeparture(d.startsAt)}</span>
            <span className="text-[color:var(--sf-muted)]">
              {d.seatsLeft > 0 ? `${d.seatsLeft} place${d.seatsLeft === 1 ? "" : "s"} left` : "Full"}
            </span>
          </li>
        ))}
      </ul>
      {data.unavailable && <p className="text-sm text-[color:var(--sf-muted)]">{data.unavailable}</p>}
    </>
  );
}
