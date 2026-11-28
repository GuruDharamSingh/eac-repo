"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { TourAsset } from "@/lib/catalogue-types";
import { listAssetsAction } from "@/lib/asset-actions";
import { getPlaceSheet, listPlaceSheet } from "@/lib/office-actions";
import { fromPlace, num, type StopDraft } from "@/components/manage/tour-builder/draft";
import { TourBookingRules } from "@/components/manage/tour-booking-rules";
import { AddPlaceBody, useAddPlace, type AsStop } from "@/components/office/add-place-popup";
import { officeHref } from "@/lib/office-links";
import { DescriptionStep, type DescriptionPart } from "../create-tour/description-step";
import { metres } from "../create-tour/route-step";
import { NarrativeField } from "../create-tour/stop-editor";
import { bodyFallback, numOrNull } from "../create-tour/types";
import { useTourEditor } from "../create-tour/use-tour-editor";
import type { RoutePoint } from "../create-tour/route-edit-map";
import { PlaceBox } from "./place-box";
import { PreviewPane } from "./preview-pane";
import { isPicture, StopPictures } from "./stop-pictures";

const RouteEditMap = dynamic(() => import("../create-tour/route-edit-map").then((m) => m.RouteEditMap), {
  ssr: false,
  loading: () => <div className="h-44 w-full bg-muted" />,
});

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";
const PREVIEW_KEY = "elktours:tour-suite:preview";

type SectionId = "title" | "meeting" | "price" | "about" | "files";
type Sel = { kind: "section"; id: SectionId } | { kind: "stop"; key: string } | { kind: "add"; sheet?: boolean };

const SECTIONS: Array<{ id: SectionId; name: string; part?: DescriptionPart }> = [
  { id: "title", name: "Title, summary, cover", part: "identity" },
  { id: "meeting", name: "Meeting point", part: "meeting" },
  { id: "price", name: "Price and booking", part: "practical" },
  { id: "about", name: "About the tour", part: "about" },
  { id: "files", name: "Files and shared notes" },
];

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * The tour edit suite (take B, 2026-11-26): no steps. An outline on the left (the tour's sections, the route's stops,
 * what is missing before publishing), the editor for what is chosen in the middle, the saved tour page on the right
 * (the column can be hidden). State and saving come from useTourEditor: tour fields save on leaving a section when
 * changed, stops on leaving a stop (or the route), and Save does both.
 */
export function TourSuite({ tourId }: { tourId: string }) {
  const ed = useTourEditor({ initialId: tourId });
  const {
    slug, published, archived, loading, saving, savedAt, rules, draft, set, draftDirty, stops, setStops, stopsDirty,
    narratives, setNarratives, legs, via, saveTour, saveStops, seedFirstStop, publish, unpublish,
  } = ed;

  const [sel, setSel] = React.useState<Sel>({ kind: "section", id: "title" });
  const [assets, setAssets] = React.useState<TourAsset[]>([]);
  const [rev, setRev] = React.useState(0);
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const lastIdx = React.useRef(0);

  // The preview choice is per viewer (localStorage; the page works without it).
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(PREVIEW_KEY) === "closed") setPreviewOpen(false);
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  const togglePreview = (open: boolean) => {
    setPreviewOpen(open);
    try {
      window.localStorage.setItem(PREVIEW_KEY, open ? "open" : "closed");
    } catch {
      /* ignore */
    }
  };

  const reloadAssets = React.useCallback(async () => {
    const list = await listAssetsAction({ threadId: tourId, includeStops: true }).catch(() => null);
    if (list) setAssets(list);
    setRev((n) => n + 1);
  }, [tourId]);
  React.useEffect(() => {
    void reloadAssets();
  }, [reloadAssets]);

  // Reload the preview after each successful save.
  const firstSave = React.useRef(true);
  React.useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    if (savedAt) setRev((n) => n + 1);
  }, [savedAt]);

  // A new draft's route starts from its meeting point, as in the wizard.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    seedFirstStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Unsaved edits: warn before the tab closes.
  const dirty = draftDirty || stopsDirty;
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const selIdx = sel.kind === "stop" ? stops.findIndex((s) => s.key === sel.key) : -1;
  if (selIdx >= 0) lastIdx.current = selIdx;
  // A saved new stop gets an id as its key: keep the same position selected.
  React.useEffect(() => {
    if (sel.kind === "stop" && selIdx < 0) {
      const next = stops[Math.min(lastIdx.current, stops.length - 1)];
      setSel(next ? { kind: "stop", key: next.key } : { kind: "section", id: "title" });
    }
  }, [sel, selIdx, stops]);

  /** Saves what changed in the part being left; false when a save was refused. */
  async function flush(): Promise<boolean> {
    if (draftDirty && !(await saveTour())) return false;
    if (stopsDirty && !(await saveStops())) return false;
    return true;
  }
  async function choose(next: Sel) {
    if (saving) return;
    const leavingSection = sel.kind === "section" && !(next.kind === "section" && next.id === sel.id);
    const leavingRoute = sel.kind !== "section" && (next.kind === "section" || next.kind === "add" || sel.kind === "add" || next.kind !== sel.kind || next.key !== sel.key);
    if (leavingSection && draftDirty && !(await saveTour())) return;
    if (leavingRoute && stopsDirty && !(await saveStops())) return;
    setSel(next);
  }
  const chooseStop = (key: string) => void choose({ kind: "stop", key });

  const patch = (key: string, p: Partial<StopDraft>) => setStops((list) => list.map((s) => (s.key === key ? { ...s, ...p, dirty: true } : s)));
  const move = (i: number, by: number) =>
    setStops((list) => {
      const j = i + by;
      if (j < 1 || j >= list.length || i < 1) return list; // stop 1 is the meeting point and stays first
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const remove = (key: string) => {
    const i = stops.findIndex((s) => s.key === key);
    const next = stops[i + 1] ?? stops[i - 1];
    setStops((list) => list.filter((s, n) => n === 0 || s.key !== key));
    if (next) setSel({ kind: "stop", key: next.key });
  };

  async function addPlace(id: string) {
    const sheet = await getPlaceSheet(id).catch(() => null);
    if (!sheet) return void toast.error("That place could not be opened.");
    const d = fromPlace(sheet.place);
    setStops((list) => [...list, d]);
    setSel((cur) => (cur.kind === "add" ? cur : { kind: "stop", key: d.key }));
  }

  if (loading) return <main className="p-6 text-sm text-muted-foreground">Opening the tour…</main>;
  if (archived) {
    return (
      <main className="mx-auto max-w-xl p-6 text-sm">
        <h1 className="text-lg font-semibold">{draft.title.trim() || "Edit tour"}</h1>
        <p className="mt-2 text-muted-foreground">This tour is archived. Publish or unpublish it from the tour list before editing it.</p>
        <p className="mt-3">
          <Link href="/manage/tours" className="underline underline-offset-4">All tours</Link>
        </p>
      </main>
    );
  }

  const picturesOf = (s: StopDraft) => (s.id ? assets.filter((a) => a.stopId === s.id && a.visible && isPicture(a)).length : 0) + (s.imageUrl ? 1 : 0);
  const hasLine = (s: StopDraft) => Boolean((narratives[s.key] ?? "").trim());
  const noLine = stops.filter((s, i) => i > 0 && !hasLine(s));
  const noPic = stops.filter((s) => picturesOf(s) === 0);
  const checks: Array<{ text: string; to: Sel }> = [];
  if (draft.title.trim().length < 2) checks.push({ text: "The tour has no title", to: { kind: "section", id: "title" } });
  if (!draft.coverImageUrl) checks.push({ text: "The tour has no cover picture", to: { kind: "section", id: "title" } });
  if (draft.meetingLat === "") checks.push({ text: "No meeting point", to: { kind: "section", id: "meeting" } });
  if (stops.length < 2) checks.push({ text: "The route has fewer than 2 stops", to: { kind: "add" } });
  if (noLine.length) checks.push({ text: `${noLine.length} ${noLine.length === 1 ? "stop has" : "stops have"} no line on the page`, to: { kind: "stop", key: noLine[0]!.key } });
  for (const s of noPic) checks.push({ text: `Stop ${stops.indexOf(s) + 1} has no picture`, to: { kind: "stop", key: s.key } });

  const filled: Record<SectionId, boolean> = {
    title: Boolean(draft.title.trim() && draft.excerpt.trim() && draft.coverImageUrl),
    meeting: draft.meetingLat !== "",
    price: draft.price !== "",
    about: Boolean(plain(draft.body)),
    files: assets.some((a) => !a.stopId),
  };
  const meeting = numOrNull(draft.meetingLat) != null && numOrNull(draft.meetingLng) != null ? { lat: numOrNull(draft.meetingLat)!, lng: numOrNull(draft.meetingLng)! } : null;
  const points: RoutePoint[] = [
    ...(meeting ? [{ key: "meet", title: "Meeting point", ...meeting }] : []),
    ...stops.filter((s) => num(s.lat) != null && num(s.lng) != null).map((s) => ({ key: s.id ?? `new:${s.key}`, title: s.title || "Stop", lat: num(s.lat)!, lng: num(s.lng)! })),
  ];
  const km = metres(legs) / 1000;
  const last = [...stops].reverse().find((s) => num(s.lat) != null && num(s.lng) != null);
  const centre = last ? { lat: num(last.lat)!, lng: num(last.lng)! } : null;
  const onRoute = new Map<string, number>();
  stops.forEach((s, i) => s.placeId && !onRoute.has(s.placeId) && onRoute.set(s.placeId, i + 1));
  const asStop: AsStop = {
    next: stops.length + 1,
    onRoute,
    add: addPlace,
    focus: (id) => {
      const st = stops.find((s) => s.placeId === id);
      if (st) setSel({ kind: "stop", key: st.key });
    },
  };

  const statusLabel = published ? "Published" : "Draft";
  const savedLine = saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved ${hhmm(savedAt)}` : "No changes yet";

  async function onSave() {
    if (await flush()) toast.success(published ? "Saved to the live page." : "Saved");
  }
  async function onPublish() {
    if (stopsDirty && !(await saveStops())) return;
    await publish();
  }

  const rowBtn = (active: boolean) => `flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/60 ${active ? "bg-accent/40" : ""}`;

  return (
    <div className="w-full text-sm">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-4 py-2">
        <Link href="/hub" className="text-muted-foreground underline underline-offset-4">Office</Link>
        <h1 className="min-w-0 max-w-[28rem] truncate text-base font-semibold">{draft.title.trim() || "Untitled tour"}</h1>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${published ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>{statusLabel}</span>
        <span className={`text-xs ${dirty ? "font-medium text-foreground" : "text-muted-foreground"}`} aria-live="polite">{savedLine}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {slug && <a href={`/tours/${slug}`} target="_blank" rel="noopener" className="text-xs underline underline-offset-4">Open the tour page</a>}
          {published && <button type="button" onClick={unpublish} disabled={saving} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50">Unpublish</button>}
          <button type="button" onClick={() => void onSave()} disabled={saving || !dirty} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          {published ? (
            <Link href={officeHref("schedule", { tourId })} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">Offer dates</Link>
          ) : (
            <button type="button" onClick={() => void onPublish()} disabled={saving} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50">Publish</button>
          )}
          <button type="button" onClick={() => togglePreview(!previewOpen)} aria-pressed={previewOpen} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          <Link href="/hub" aria-label="Close the suite" className="px-2 py-1 text-lg leading-none text-muted-foreground hover:text-foreground">✕</Link>
        </span>
      </header>

      <div className={`grid gap-0 ${previewOpen ? "lg:grid-cols-[18rem_minmax(0,1fr)_26rem]" : "lg:grid-cols-[18rem_minmax(0,1fr)]"}`}>
        {/* Outline */}
        <nav aria-label="Outline" className="space-y-5 border-b border-border p-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <section>
            <h2 className={label}>The tour</h2>
            <ul className="mt-1 divide-y divide-border rounded-md border border-border">
              {SECTIONS.map((s) => {
                const active = sel.kind === "section" && sel.id === s.id;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => void choose({ kind: "section", id: s.id })} aria-current={active ? "true" : undefined} className={rowBtn(active)}>
                      <span className={`flex-1 ${active ? "font-semibold" : ""}`}>{s.name}</span>
                      <span className={filled[s.id] ? "text-primary" : "text-muted-foreground"} aria-label={filled[s.id] ? "Filled" : "Empty"}>{filled[s.id] ? "✓" : "○"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className={label}>{`Route · ${stops.length} ${stops.length === 1 ? "stop" : "stops"}${legs ? ` · ${km.toFixed(1)} km` : ""}`}</h2>
            <RouteEditMap
              places={[]}
              activeId={null}
              onSelect={(id) => {
                if (!id.startsWith("point:")) return;
                const k = id.slice(6);
                const st = stops.find((s) => s.id === k || `new:${s.key}` === k) ?? (k === "meet" ? stops[0] : undefined);
                if (st) chooseStop(st.key);
              }}
              points={points}
              legs={legs}
              via={via}
              editable={false}
              onViaChange={() => {}}
              className="h-44 w-full"
            />
            <ol className="divide-y divide-border rounded-md border border-border">
              {stops.map((s, i) => {
                const active = sel.kind === "stop" && sel.key === s.key;
                const lacks: string[] = [];
                if (i > 0 && !hasLine(s)) lacks.push("no line");
                if (picturesOf(s) === 0) lacks.push("no picture");
                return (
                  <li key={s.key}>
                    <button type="button" onClick={() => chooseStop(s.key)} aria-current={active ? "true" : undefined} className={rowBtn(active)}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${active ? "font-semibold" : "font-medium"}`}>{s.title || "Untitled stop"}</span>
                        {lacks.length > 0 && <span className="block text-xs text-muted-foreground">{lacks.join(" · ")}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void choose({ kind: "add" })} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">+ Add a stop</button>
              <button type="button" onClick={() => void choose({ kind: "add", sheet: true })} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">+ New place</button>
            </div>
          </section>

          <section>
            <h2 className={label}>Before publishing</h2>
            {checks.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Nothing to fix.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {checks.map((c, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => void choose(c.to)} className="text-left text-xs underline underline-offset-4">{c.text}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </nav>

        {/* Editor */}
        <main className="min-w-0 p-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {sel.kind === "section" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{SECTIONS.find((s) => s.id === sel.id)!.name}</h2>
              {sel.id === "files" ? (
                <ul className="space-y-1">
                  {(
                    [
                      ["Pictures and files", `/manage/tours/${tourId}/assets`],
                      ["Fly-over film", `/manage/tours/${tourId}/flyover`],
                      ["Collaborate", `/manage/tours/${tourId}/collaborate`],
                      ["Guide notes (shared notes)", `/manage/tours/${tourId}/notes`],
                    ] as const
                  ).map(([text, href]) => (
                    <li key={href}>
                      <a href={href} className="underline underline-offset-4">{text}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <DescriptionStep key={sel.id} draft={draft} set={set} tourId={tourId} only={SECTIONS.find((s) => s.id === sel.id)!.part} />
              )}
              {sel.id === "price" && rules && (
                <section className="space-y-2 border-t border-border pt-4">
                  <h3 className="text-lg font-semibold">Tour type and booking rules</h3>
                  <div className="max-w-md">
                    <TourBookingRules key={tourId} tourId={tourId} type={rules.type ?? null} defaults={rules.defaults} />
                  </div>
                </section>
              )}
            </div>
          )}

          {sel.kind === "add" && <AddStop key={sel.sheet ? "sheet" : "find"} startWithSheet={Boolean(sel.sheet)} stops={stops} centre={centre} asStop={asStop} onBack={() => setSel(stops.length ? { kind: "stop", key: stops[stops.length - 1]!.key } : { kind: "section", id: "title" })} />}

          {sel.kind === "stop" && selIdx >= 0 && (
            <StopPanel
              tourId={tourId}
              stop={stops[selIdx]!}
              index={selIdx}
              count={stops.length}
              narrative={narratives[stops[selIdx]!.key] ?? ""}
              onNarrative={(v) => setNarratives((m) => ({ ...m, [stops[selIdx]!.key]: v }))}
              patch={(p) => patch(stops[selIdx]!.key, p)}
              assets={assets}
              reloadAssets={reloadAssets}
              onGo={(i) => chooseStop(stops[i]!.key)}
              onMove={(by) => move(selIdx, by)}
              onRemove={() => remove(stops[selIdx]!.key)}
            />
          )}
          {sel.kind === "stop" && selIdx < 0 && stops.length === 0 && <p className="text-muted-foreground">Add a stop to start the route.</p>}
        </main>

        {/* Preview */}
        {previewOpen && (
          <aside aria-label="Preview" className="border-t border-border p-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <PreviewPane slug={slug} rev={rev} />
          </aside>
        )}
      </div>
    </div>
  );
}

/** The chosen stop: header, its line, text, guide notes, pictures and place. */
function StopPanel({
  tourId, stop, index, count, narrative, onNarrative, patch, assets, reloadAssets, onGo, onMove, onRemove,
}: {
  tourId: string;
  stop: StopDraft;
  index: number;
  count: number;
  narrative: string;
  onNarrative: (v: string) => void;
  patch: (p: Partial<StopDraft>) => void;
  assets: TourAsset[];
  reloadAssets: () => Promise<void>;
  onGo: (i: number) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const kind = index === 0 ? "Meeting point" : stop.placeId ? "One of our places" : "Own position";
  const mins = num(stop.durationMinutes);
  const btn = "rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40";
  return (
    <section className="space-y-5" aria-label={`Stop ${index + 1}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{`${index + 1} · ${stop.title || "Untitled stop"}`}</h2>
          <p className="text-xs text-muted-foreground">{kind}{mins ? ` · ${mins} minutes` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={index === 0} onClick={() => onGo(index - 1)} className={btn}>‹ {index}</button>
          <button type="button" disabled={index >= count - 1} onClick={() => onGo(index + 1)} className={btn}>{index + 2} ›</button>
          {index > 0 && (
            <>
              <button type="button" disabled={index <= 1} onClick={() => onMove(-1)} className={btn} aria-label="Earlier">↑</button>
              <button type="button" disabled={index >= count - 1} onClick={() => onMove(1)} className={btn} aria-label="Later">↓</button>
              <button type="button" onClick={onRemove} className={`${btn} hover:text-destructive`}>Remove from route</button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="block">
          <span className={label}>Stop name</span>
          <input value={stop.title} onChange={(e) => patch({ title: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className={label}>Minutes here</span>
          <input type="number" min={0} step={5} value={stop.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} className={field} />
        </label>
      </div>

      <NarrativeField value={narrative} onChange={onNarrative} fallback={bodyFallback(stop.body)} help="Shown beside the picture on the stage." />

      <div>
        <span className={label}>What the visitor reads</span>
        <div className="mt-1">
          <RichTextEditor key={`body-${stop.key}`} value={stop.body} onChange={(v) => patch({ body: v })} toolbar="compact" />
        </div>
      </div>

      <div>
        <span className={label}>Notes for the guide (private)</span>
        <div className="mt-1">
          <RichTextEditor key={`notes-${stop.key}`} value={stop.guideNotes} onChange={(v) => patch({ guideNotes: v })} toolbar="compact" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className={label}>Pictures in the order the stage shows them</h3>
        {stop.id ? (
          <StopPictures tourId={tourId} stopId={stop.id} placeId={stop.placeId} assets={assets} reload={reloadAssets} />
        ) : (
          <p className="text-muted-foreground">Save the stops first; then pictures can be added to this one.</p>
        )}
      </div>

      {stop.placeId && (
        <div className="space-y-2">
          <h3 className={label}>The place</h3>
          <PlaceBox placeId={stop.placeId} />
        </div>
      )}
    </section>
  );
}

/** Add a stop (one of our places by name) and the Add a place sheet, whose finds become the next stops. */
function AddStop({ stops, centre, asStop, onBack, startWithSheet = false }: { startWithSheet?: boolean; stops: StopDraft[]; centre: { lat: number; lng: number } | null; asStop: AsStop; onBack: () => void }) {
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<Array<{ id: string; title: string; address: string | null }> | null>(null);
  const [sheet, setSheet] = React.useState(startWithSheet);
  const [seed, setSeed] = React.useState("");
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      listPlaceSheet(q)
        .then((rows) => live && setFound(rows.slice(0, 8)))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query]);

  if (sheet) return <NewPlace centre={centre} asStop={asStop} initialQuery={seed} onBack={() => setSheet(false)} />;
  return (
    <section className="max-w-xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Add a stop</h2>
        <button type="button" onClick={onBack} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">Back</button>
      </div>
      <div>
        <label htmlFor="suite-find" className={label}>One of our places, by name</label>
        <input id="suite-find" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Place name" className={field} autoFocus />
        {found && (
          <ul className="mt-1 divide-y divide-border border border-border">
            {found.length === 0 && <li className="px-3 py-2 text-muted-foreground">No place of ours by that name.</li>}
            {found.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  {p.address && <span className="block truncate text-xs text-muted-foreground">{p.address}</span>}
                </span>
                {asStop.onRoute.has(p.id) ? (
                  <span className="shrink-0 text-xs text-muted-foreground">On the route</span>
                ) : (
                  <button type="button" onClick={() => { void asStop.add(p.id); setQuery(""); }} className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                    Add as stop {stops.length + 1}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={() => { setSeed(query.trim()); setSheet(true); }} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">+ New place</button>
    </section>
  );
}

function NewPlace({ centre, asStop, initialQuery, onBack }: { centre: { lat: number; lng: number } | null; asStop: AsStop; initialQuery: string; onBack: () => void }) {
  const m = useAddPlace({ centre, asStop, initialQuery });
  return (
    <div className="rounded-md border border-border p-4">
      <AddPlaceBody
        m={m}
        mapClass="h-[22rem] w-full"
        head={
          <>
            {m.placeId && (
              <button type="button" onClick={m.another} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">Add another</button>
            )}
            <button type="button" onClick={onBack} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">Back to the stops</button>
          </>
        }
      />
    </div>
  );
}
