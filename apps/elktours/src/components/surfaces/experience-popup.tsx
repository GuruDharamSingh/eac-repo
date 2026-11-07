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
import type { ExperiencePopupData } from "@/components/surfaces/popup-types";
import type { ExperienceFormat } from "@/lib/catalogue-types";
import { formatDuration, formatPrice } from "@/lib/tour-format";

type Tab = "overview" | "artist" | "tours";

const FORMAT_LABEL: Record<ExperienceFormat, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "In person or online",
};

/** The descriptor an experience card opens. `props.id` is the experience thread id. */
export function experienceDescriptor(e: { id: string; slug?: string; title?: string }): SurfaceDescriptor {
  return { type: "custom", key: "experience", title: e.title, kind: "service", size: "wide", props: { id: e.id, slug: e.slug } };
}

/**
 * The experience popup: Overview · Artist (linked people, each to their
 * ArtDirect profile) · In tours (the tours that stop at it; each opens the
 * tour popup on top). Phase A is inquiry-only, so the primary action asks.
 */
export function ExperiencePopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : null;
  const slug = typeof descriptor.props?.slug === "string" ? descriptor.props.slug : null;
  const { data, error } = usePopupData<ExperiencePopupData>(id ? `/api/surfaces/experience/${encodeURIComponent(id)}` : null);
  const [tab, setTab] = React.useState<Tab>("overview");
  const surface = useSurfaceOptional();

  const href = `/experiences/${data?.experience.slug ?? slug ?? ""}`;

  if (!id || error) {
    return (
      <SurfaceFrame
        kind="service"
        kicker="Experience"
        title={descriptor.title ?? "Experience"}
        actions={slug ? [{ label: "Open page", href, primary: true }] : []}
      >
        <p className="text-sm text-[color:var(--sf-muted)]">{error ?? "This experience could not be found."}</p>
      </SurfaceFrame>
    );
  }
  if (!data) {
    return (
      <SurfaceFrame kind="service" kicker="Experience" title={descriptor.title ?? "Experience"}>
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  const e = data.experience;
  const artists = e.people.filter((p) => p.role === "artist");
  const hosts = e.people.filter((p) => p.role === "host");
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "artist", label: artists.length > 1 ? "Artists" : "Artist" },
    { key: "tours", label: data.tours.length ? `In tours (${data.tours.length})` : "In tours" },
  ];
  const actions: SurfaceAction[] = [];
  if (data.canEdit) actions.push({ label: "Edit", href: `/manage/experiences/${e.id}`, quiet: true });
  actions.push({ label: "Open page", href });
  actions.push({ label: "Ask about it", href: `${href}#inquire`, primary: true });

  return (
    <SurfaceFrame
      kind="service"
      kicker={e.status === "published" ? "Experience" : `Experience · ${e.status}`}
      title={e.title}
      actions={actions}
    >
      <SurfaceTabs<Tab> id="experience-popup" label="Experience" tabs={tabs} current={tab} onSelect={setTab} />
      <SurfaceTabPanel id="experience-popup" current={tab}>
        {tab === "overview" && (
          <>
            {e.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.coverImageUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
            )}
            {e.excerpt && <p className="text-[0.95rem] leading-relaxed">{e.excerpt}</p>}
            <SurfaceFacts
              facts={[
                { label: "Format", value: FORMAT_LABEL[e.format] ?? null },
                { label: "Where", value: e.location ?? (e.isOnline ? "Online" : null) },
                { label: "Length", value: formatDuration(e.durationMinutes) },
                { label: "Price", value: e.price ? formatPrice(e.price, e.currency) : null },
                { label: "With", value: artists.length ? artists.map((a) => a.name).join(", ") : null },
              ]}
            />
            {e.highlights.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {e.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {e.body && (
              // Sanitised on write (lib/experiences).
              <div className="prose prose-sm max-w-none text-[color:var(--sf-fg)]" dangerouslySetInnerHTML={{ __html: e.body }} />
            )}
          </>
        )}
        {tab === "artist" && (
          <>
            {e.people.length === 0 ? (
              <p className="text-sm text-[color:var(--sf-muted)]">The artist for this experience has not been named yet.</p>
            ) : (
              <ul className="grid gap-3">
                {[...artists, ...hosts].map((p) => (
                  <li key={`${p.role}-${p.userId}`} className="flex items-center gap-3 rounded-md border border-[color:var(--sf-line)] p-3">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-serif text-lg">
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs uppercase tracking-wider text-[color:var(--sf-muted)]">{p.role === "artist" ? "Artist" : "Host"}</p>
                    </div>
                    {p.profileUrl && (
                      <a href={p.profileUrl} target="_blank" rel="noopener" className="text-sm underline underline-offset-4">
                        Artist profile ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {e.serviceUrl && (
              <p className="text-sm">
                <a href={e.serviceUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                  See the artist&apos;s own listing on ArtDirect ↗
                </a>
              </p>
            )}
          </>
        )}
        {tab === "tours" &&
          (data.tours.length === 0 ? (
            <p className="text-sm text-[color:var(--sf-muted)]">Not part of a tour yet: it can be booked on its own by asking.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--sf-line)] rounded-md border border-[color:var(--sf-line)]">
              {data.tours.map((t) => (
                <li key={t.stopId} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <button
                    type="button"
                    className="text-left font-medium underline-offset-4 hover:underline"
                    onClick={() =>
                      surface?.push({ type: "custom", key: "tour", title: t.tourTitle, kind: "event", size: "wide", props: { id: t.threadId, slug: t.tourSlug, tab: "stops" } })
                    }
                  >
                    {t.tourTitle}
                  </button>
                  <span className="text-[color:var(--sf-muted)]">Stop {t.position + 1}</span>
                </li>
              ))}
            </ul>
          ))}
      </SurfaceTabPanel>
    </SurfaceFrame>
  );
}
