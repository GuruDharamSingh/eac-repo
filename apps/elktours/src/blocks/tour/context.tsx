"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { TourDeparture, TourStop } from "@elkdonis/commerce/server";
import type { Tour, TourFilm } from "@/lib/tours";
import { patchTourAction, type TourPatch } from "@/lib/tour-live-actions";

/**
 * What every tour block reads: the tour (stops without guide notes), what the
 * booking box needs, and the other tours for "More tours". Supplied once by
 * the tour page (or, in the layout editor, by a sample tour) through
 * TourPageProvider, so a block's own props hold only its settings — which is
 * the shape a Puck document stores.
 */
export interface TourPageData {
  tour: Tour & { stops: TourStop[]; departures: TourDeparture[] };
  canEdit: boolean;
  unavailable: string | null;
  maxParty: number;
  signedInEmail: string | null;
  googleMapsKey: string | null;
  others: { tour: Tour; next: TourDeparture | null }[];
}

/** The fields an editor can change in place; the same names patchTourAction takes. */
export interface TourDraft {
  title: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  price: number | null;
  durationMinutes: number | null;
  location: string;
  highlights: string[];
  includes: string[];
  languages: string[];
  effort: string;
  maxParty: number | null;
  film: TourFilm | null;
}

interface EditState {
  editing: boolean;
  draft: TourDraft;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  set: <K extends keyof TourDraft>(key: K, value: TourDraft[K]) => void;
  start: () => void;
  cancel: () => void;
  save: () => Promise<void>;
}

const PageCtx = createContext<TourPageData | null>(null);
const EditCtx = createContext<EditState | null>(null);

export function draftOf(t: Tour): TourDraft {
  return {
    title: t.title,
    excerpt: t.excerpt ?? "",
    body: t.body ?? "",
    status: t.status === "published" ? "published" : "draft",
    price: t.price,
    durationMinutes: t.durationMinutes,
    location: t.location ?? "",
    highlights: t.details.highlights,
    includes: t.details.includes,
    languages: t.details.languages,
    effort: t.details.effort ?? "",
    maxParty: t.details.maxParty,
    film: t.film,
  };
}

export function TourPageProvider({ data, children }: { data: TourPageData; children: ReactNode }) {
  const router = useRouter();
  const initial = useMemo(() => draftOf(data.tour), [data.tour]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TourDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => {
    const out: TourPatch = {};
    for (const k of Object.keys(draft) as (keyof TourDraft)[]) {
      if (JSON.stringify(draft[k]) !== JSON.stringify(initial[k])) (out as Record<string, unknown>)[k] = draft[k];
    }
    return out;
  }, [draft, initial]);

  const set = useCallback(<K extends keyof TourDraft>(key: K, value: TourDraft[K]) => setDraft((d) => ({ ...d, [key]: value })), []);

  const edit: EditState = {
    editing,
    draft,
    dirty: Object.keys(changed).length > 0,
    saving,
    error,
    set,
    start: () => { setDraft(initial); setError(null); setEditing(true); },
    cancel: () => { setDraft(initial); setError(null); setEditing(false); },
    save: async () => {
      if (Object.keys(changed).length === 0) { setEditing(false); return; }
      setSaving(true);
      setError(null);
      const res = await patchTourAction(data.tour.id, changed);
      setSaving(false);
      if (res.ok === false) { setError(res.error); return; }
      setEditing(false);
      if (res.slug !== data.tour.slug) router.replace(`/tours/${res.slug}`);
      else router.refresh();
    },
  };

  return (
    <PageCtx.Provider value={data}>
      <EditCtx.Provider value={data.canEdit ? edit : null}>{children}</EditCtx.Provider>
    </PageCtx.Provider>
  );
}

export function useTourPage(): TourPageData | null {
  return useContext(PageCtx);
}

/**
 * The edit state, or a read-only view of the stored tour when no one may
 * edit (visitors, the layout editor). Blocks read values from here, so what
 * they draw while editing is the draft.
 */
export function useTourEdit(): EditState & { canEdit: boolean } {
  const page = useContext(PageCtx);
  const edit = useContext(EditCtx);
  if (edit) return { ...edit, canEdit: true };
  const draft = page ? draftOf(page.tour) : (null as unknown as TourDraft);
  const noop = () => {};
  return { editing: false, draft, dirty: false, saving: false, error: null, set: noop, start: noop, cancel: noop, save: async () => {}, canEdit: false };
}
