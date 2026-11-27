"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { getScheduleSheet, type ScheduleSheet, type ScheduleSheetSlot } from "@/lib/office-actions";
import { createSlots, previewSlots } from "@/lib/slot-actions";
import { formatDay } from "@/lib/schedule-plan";
import { StandingPanel } from "@/components/office/standing-panel";
import { tourEditorHref } from "@/lib/office-links";

/** The hub card's descriptor (registered as `office-schedule` in HubSurfaces). */
export const scheduleTourDescriptor: SurfaceDescriptor = {
  type: "custom",
  key: "office-schedule",
  title: "Offer a tour",
  kind: "event",
  size: "wide",
};

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_TIMES = 4;

interface Row {
  day: string;
  tourId: string;
  times: string[];
  /** Owners: "" = the tour's author. Guides always lead their own runs. */
  guideId: string;
}

interface Group {
  tourId: string;
  guideId: string;
  times: string[];
  dates: string[];
}

/** One createSlots / previewSlots call per (tour, guide, set of times); days that share all three go together. */
function groupRows(rows: Row[]): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const times = [...new Set(r.times)].sort();
    const key = `${r.tourId}|${r.guideId}|${times.join(",")}`;
    const g = groups.get(key) ?? { tourId: r.tourId, guideId: r.guideId, times, dates: [] };
    g.dates.push(r.day);
    groups.set(key, g);
  }
  return [...groups.values()];
}

const addMinutes = (t: string, mins: number) => {
  const m = ((Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Offer a tour (hub, 2026-11-19): pick a tour, click days on the calendar, and give each day one or more start
 * times. Each picked day is a row below the calendar where times are added or removed and the tour can be changed
 * for that day. Publishing creates the runs through slot-actions createSlots (the same planner as the phone's
 * New slots screen: clashes and duplicates are skipped, a guide schedules only their own tours). A tour is listed
 * on the public tours page once it has an upcoming run.
 *
 * There is no limit on how many days are published at once. A run that overlaps another run of the same guide is
 * flagged on its day (previewSlots) and is still published (2026-11-24).
 */
export function ScheduleTourPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<ScheduleSheet | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // `props.tourId` preselects the tour (the tour page's editor menu links here).
  const [tourId, setTourId] = React.useState<string>(typeof descriptor.props?.tourId === "string" ? descriptor.props.tourId : "");
  const [places, setPlaces] = React.useState(8);
  const [guideId, setGuideId] = React.useState<string>("");
  const [month, setMonth] = React.useState<string>("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [lastTime, setLastTime] = React.useState("10:00");
  const [busy, setBusy] = React.useState(false);
  // Overlap warnings by day: "10:00 Clashes with Latin Quarter at 10:00".
  // "days": specific days and times. "standing": weekdays kept open for registration (StandingPanel).
  const [mode, setMode] = React.useState<"days" | "standing">("days");
  const [warnings, setWarnings] = React.useState<Map<string, string[]>>(new Map());

  const load = React.useCallback(async () => {
    try {
      const s = await getScheduleSheet();
      setSheet(s);
      setMonth((m) => m || s.today.slice(0, 7));
      setTourId((id) => id || (s.tours.find((t) => t.published) ?? s.tours[0])?.id || "");
    } catch {
      setError("Could not load the schedule.");
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  // Check the picked days for overlaps (debounced); a late answer for older rows is dropped.
  const warnSeq = React.useRef(0);
  React.useEffect(() => {
    if (!sheet || rows.length === 0) {
      setWarnings(new Map());
      return;
    }
    const mine = ++warnSeq.current;
    const t = setTimeout(async () => {
      const next = new Map<string, string[]>();
      for (const g of groupRows(rows)) {
        const r = await previewSlots({
          tourId: g.tourId,
          dates: g.dates,
          times: g.times,
          maxPlaces: places,
          guideUserId: sheet.isOwner ? g.guideId || null : sheet.selfGuideId,
        }).catch(() => null);
        if (!r || !r.ok) continue;
        for (const it of r.preview.items) {
          if (it.reason !== "clash") continue;
          next.set(it.day, [...(next.get(it.day) ?? []), `${it.time}: ${it.message ?? "overlaps another run"}`]);
        }
      }
      if (mine === warnSeq.current) setWarnings(next);
    }, 400);
    return () => clearTimeout(t);
  }, [rows, places, sheet]);

  if (error) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Offer a tour">
        <p className="text-sm text-muted-foreground">{error}</p>
      </SurfaceFrame>
    );
  }
  if (!sheet) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Offer a tour">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }
  if (sheet.tours.length === 0) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Offer a tour" actions={[{ label: "Create a tour", href: tourEditorHref(), primary: true }]}>
        <p className="text-sm text-muted-foreground">There are no tours to schedule yet.</p>
      </SurfaceFrame>
    );
  }

  const tourTitle = (id: string) => sheet.tours.find((t) => t.id === id)?.title ?? "Tour";
  const authorName = (tourId: string) => {
    const author = sheet.tours.find((t) => t.id === tourId)?.authorId;
    return author ? sheet.guides?.find((g) => g.id === author)?.name ?? null : null;
  };
  const byDay = new Map<string, ScheduleSheetSlot[]>();
  for (const s of sheet.slots) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
  const picked = new Set(rows.map((r) => r.day));

  function toggleDay(day: string) {
    if (picked.has(day)) setRows((rs) => rs.filter((r) => r.day !== day));
    else setRows((rs) => [...rs, { day, tourId, times: [lastTime], guideId }].sort((a, b) => a.day.localeCompare(b.day)));
  }
  const patchRow = (day: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.day === day ? { ...r, ...patch } : r)));

  const total = rows.reduce((n, r) => n + new Set(r.times).size, 0);

  async function publish() {
    if (total === 0) return;
    setBusy(true);
    let created = 0;
    let skipped = 0;
    const problems: string[] = [];
    const done = new Set<string>();
    let clashes = 0;
    for (const g of groupRows(rows)) {
      const r = await createSlots({
        tourId: g.tourId,
        dates: g.dates,
        times: g.times,
        maxPlaces: places,
        guideUserId: sheet!.isOwner ? g.guideId || null : sheet!.selfGuideId,
      }).catch(() => ({ ok: false as const, error: "Could not create the runs." }));
      if (r.ok) {
        created += r.created;
        skipped += r.skipped;
        clashes += r.clashes;
        g.dates.forEach((d) => done.add(d));
      } else {
        problems.push(`${tourTitle(g.tourId)}: ${r.error}`);
      }
    }
    setBusy(false);
    if (created) toast.success(`${created} departure${created === 1 ? "" : "s"} published${skipped ? `; ${skipped} skipped (past or already there)` : ""}.`);
    if (clashes) toast.message(`${clashes} departure${clashes === 1 ? " overlaps" : "s overlap"} another run of the same guide.`);
    problems.forEach((p) => toast.error(p));
    setRows((rs) => rs.filter((r) => !done.has(r.day)));
    await load();
    router.refresh();
  }

  // Month grid, Monday first.
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: Array<string | null> = [
    ...Array(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7));

  const actions: SurfaceAction[] = [
    { label: "Full schedule", href: "/manage/schedule", quiet: true },
    ...(mode === "standing" ? [] : [{
      label: busy ? "Publishing…" : total ? `Publish ${total} departure${total === 1 ? "" : "s"}` : "Publish departures",
      primary: true,
      disabled: busy || total === 0,
      onClick: publish,
    } satisfies SurfaceAction]),
  ];

  return (
    <SurfaceFrame
      kind="event"
      kicker="Office"
      title="Offer a tour"
      actions={actions}
      status={mode === "standing" ? "Open for registration" : total ? `${rows.length} day${rows.length === 1 ? "" : "s"} · ${total} start time${total === 1 ? "" : "s"}` : "Click days on the calendar"}
    >
      <div role="tablist" aria-label="How to offer" className="mb-4 inline-flex rounded-md border border-border p-0.5 text-sm">
        {(
          [
            ["days", "Specific days"],
            ["standing", "Standing listing"],
          ] as const
        ).map(([m, text]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>
      {mode === "standing" ? (
        <StandingPanel sheet={sheet} initialTourId={tourId} />
      ) : (
      <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tour</span>
            <select value={tourId} onChange={(e) => setTourId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2">
              {sheet.tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.published ? "" : " (draft)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Places</span>
            <input
              type="number"
              min={1}
              max={500}
              value={places}
              onChange={(e) => setPlaces(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          {sheet.guides ? (
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Guide for new days</span>
              <select value={guideId} onChange={(e) => setGuideId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="">Tour's author</option>
                {sheet.guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2">You lead the runs you offer.</p>
          )}
        </div>

        <section aria-label="Calendar" className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-serif text-lg">{monthName}</span>
            <span className="flex gap-1">
              <button type="button" className="rounded px-2 py-1 hover:bg-accent disabled:opacity-30" disabled={month <= sheet.today.slice(0, 7)} onClick={() => shift(-1)} aria-label="Earlier month">
                ‹
              </button>
              <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => shift(1)} aria-label="Later month">
                ›
              </button>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK.map((w) => (
              <span key={w} className="pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={i} />;
              const past = day < sheet.today;
              const on = picked.has(day);
              const runs = (byDay.get(day) ?? []).filter((s) => s.status === "scheduled");
              const mine = runs.some((s) => s.tourId === tourId);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  title={runs.length ? runs.map((s) => `${s.time} ${s.tourTitle}`).join("\n") : undefined}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-md border tabular-nums transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : past
                        ? "border-transparent text-muted-foreground/40"
                        : "border-transparent hover:border-border hover:bg-accent/60"
                  }`}
                >
                  {Number(day.slice(8))}
                  {runs.length > 0 && (
                    <span className="absolute bottom-1 flex gap-0.5" aria-hidden="true">
                      {runs.slice(0, 3).map((s) => (
                        <span key={s.id} className={`h-1 w-1 rounded-full ${on ? "bg-primary-foreground" : s.tourId === tourId ? "bg-primary" : "bg-muted-foreground/50"}`} />
                      ))}
                    </span>
                  )}
                  {mine && <span className="sr-only">has a run of this tour</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Dots: runs already on that day (coloured for the chosen tour).</p>
        </section>
        </div>

        <section aria-label="New departures">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Departures to publish</h3>
          {rows.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No days picked yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {rows.map((r) => {
                const already = byDay.get(r.day) ?? [];
                const clash = warnings.get(r.day) ?? [];
                return (
                  <li key={r.day} className="space-y-2 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-full font-medium sm:w-auto sm:min-w-[7.5rem]">{formatDay(r.day, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <select
                        value={r.tourId}
                        onChange={(e) => patchRow(r.day, { tourId: e.target.value })}
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5"
                        aria-label="Tour on this day"
                      >
                        {sheet.tours.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      {sheet.guides ? (
                        <select
                          value={r.guideId}
                          onChange={(e) => patchRow(r.day, { guideId: e.target.value })}
                          className="rounded-md border border-input bg-background px-2 py-1.5"
                          aria-label="Guide on this day"
                        >
                          <option value="">{authorName(r.tourId) ? `${authorName(r.tourId)} (author)` : "Tour's author"}</option>
                          {sheet.guides.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">Guide: you</span>
                      )}
                      <button type="button" onClick={() => toggleDay(r.day)} className="px-2 text-muted-foreground hover:text-destructive" aria-label="Remove this day">
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.times.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-background pl-2">
                          <input
                            type="time"
                            step={900}
                            value={t}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              setLastTime(v);
                              patchRow(r.day, { times: r.times.map((x, j) => (j === i ? v : x)) });
                            }}
                            className="bg-transparent py-1 tabular-nums"
                            aria-label="Start time (Paris)"
                          />
                          <button
                            type="button"
                            disabled={r.times.length <= 1}
                            onClick={() => patchRow(r.day, { times: r.times.filter((_, j) => j !== i) })}
                            className="px-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
                            aria-label="Remove this start time"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {r.times.length < MAX_TIMES && (
                        <button
                          type="button"
                          onClick={() => patchRow(r.day, { times: [...r.times, addMinutes(r.times[r.times.length - 1] ?? lastTime, 180)] })}
                          className="rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                        >
                          + start time
                        </button>
                      )}
                    </div>
                    {clash.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400" role="status">
                        Overlap, will still be published. {clash.join(" · ")}
                      </p>
                    )}
                    {already.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Already that day:{" "}
                        {already.map((s, i) => (
                          <span key={s.id} className={s.status === "cancelled" ? "line-through" : ""}>
                            {i ? " · " : ""}
                            {s.time} {s.tourTitle} ({s.seatsTaken}/{s.capacity})
                          </span>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Times are Paris time. Length, minimum and booking cutoff come from the tour's own settings.</p>
        </section>
      </div>
      )}
    </SurfaceFrame>
  );
}
