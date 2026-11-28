"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { ContentLibrary, type RemoteSource } from "@elkdonis/content/ui";
import type { ContentListItem } from "@elkdonis/content/model";
import { contentQueryParams } from "@elkdonis/content/query";
import { setOfferFeaturedAction } from "@/lib/offer-featured-actions";
import { loadCurrentWorkAction } from "@/lib/offer-card-actions";
import type { CurrentWorkData } from "@/lib/offer-card-types";
// The library draws unstyled without its own stylesheet (seen live 2026-11-27: bare rows in the picker).
import "@elkdonis/content/content.css";
import "@elkdonis/cms-ui/offer-surface.css";
import "./current-work.css";

const PICK_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Spectral:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap";

type Search = Extract<RemoteSource, { search: unknown }>["search"];
type Tab = "work" | "services";
const PICK_TABS: readonly { id: Tab; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "services", label: "Services" },
];

/** Published rows only: the picker must not offer a draft (the save action would refuse it anyway). */
const PUBLISHED = ["published", "live"] as const;

/** Types the page can lead with, apart from services (those are in the offers view only). */
const WORK_TYPES = ["event", "meeting", "workshop", "series", "writing", "artwork", "product"] as never[];

function useSource(): RemoteSource {
  return React.useMemo<RemoteSource>(() => {
    const search: Search = async (q) => {
      const qs = contentQueryParams({ ...q, statuses: [...PUBLISHED] as never }).toString();
      const res = await fetch(`/api/content/search?${qs}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; items?: unknown[]; nextCursor?: string | null; facets?: Record<string, unknown>; missing?: string[] };
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load your pieces.");
      return {
        items: Array.isArray(body.items) ? body.items : [],
        nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
        facets: { types: {}, statuses: {}, stores: [], sale: {}, ...(body.facets ?? {}) },
        missing: Array.isArray(body.missing) ? body.missing : [],
      } as Awaited<ReturnType<Search>>;
    };
    return { search };
  }, []);
}

/**
 * The content library as the picker for what leads the page (Decision 1). It is a layer pushed over
 * the card's surface: the org's published pieces (events, series, writing, artworks; services on
 * their own tab, since the library lists them only in its offers view). Picking one calls
 * setOfferFeaturedAction, which re-checks that a signed-out visitor could see it.
 */
export function CurrentWorkPick({
  orgId,
  orgSlug,
  currentKey,
  onSaved,
}: {
  orgId: string;
  orgSlug: string;
  currentKey: string | null;
  onSaved: (data: CurrentWorkData | null, note: string) => void;
}) {
  const surface = useSurface();
  const router = useRouter();
  const source = useSource();
  const base = React.useId();
  const [tab, setTab] = React.useState<Tab>("work");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function pick(item: ContentListItem) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await setOfferFeaturedAction(orgSlug, item.key);
    if (r.ok === false) {
      setBusy(false);
      setError(r.error ?? "Could not save.");
      return;
    }
    const fresh = await loadCurrentWorkAction(orgSlug);
    onSaved(fresh.ok ? fresh.data : null, `Saved. “${item.title}” now leads your page.`);
    router.refresh();
    setBusy(false);
    surface.pop();
  }

  return (
    <SurfaceFrame
      kind="gallery"
      kicker="Choose a piece"
      title="Choose what leads your page"
      flush
      status={busy ? "Saving…" : error ?? "Pick one piece. It shows on your site straight away."}
      statusTone={error ? "error" : "normal"}
    >
      <div className="osf-root eac-offer cwp-dark cwp-pick" data-ft="para">
        <link rel="stylesheet" href={PICK_FONTS_HREF} precedence="default" />
        <div className="cwp-tabs" role="tablist" aria-label="What to choose from">
          {PICK_TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${base}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className="cwp-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const to = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!to) return;
                e.preventDefault();
                const next = PICK_TABS[(i + to + PICK_TABS.length) % PICK_TABS.length].id;
                setTab(next);
                document.getElementById(`${base}-tab-${next}`)?.focus();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="cwp-pick-body" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tab}`}>
          <p className="cwp-pick-note">
            {tab === "work"
              ? "Events, series, writing and artworks. Only published, public pieces of this organisation are listed."
              : "Your services. Only published, public ones are listed."}
          </p>
          {error && (
            <p className="cwp-pick-error" role="alert">
              {error}
            </p>
          )}
          <ContentLibrary
            key={tab}
            mode="pick"
            source={source}
            scope={{ kind: "org", orgId }}
            view={tab === "work" ? "published" : "offers"}
            lockView
            types={tab === "work" ? WORK_TYPES : (["service"] as never[])}
            density="compact"
            value={currentKey ?? undefined}
            searchPlaceholder="Search your pieces"
            onPick={(item) => void pick(item)}
          />
        </div>
      </div>
    </SurfaceFrame>
  );
}
