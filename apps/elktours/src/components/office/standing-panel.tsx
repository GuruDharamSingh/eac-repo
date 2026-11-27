"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ScheduleSheet } from "@/lib/office-actions";
import { MAX_STANDING_AHEAD_DAYS, WEEKDAYS, formatDay } from "@/lib/schedule-plan";
import {
  listStandingRules,
  previewStandingRule,
  saveStandingRule,
  stopStandingRule,
  type StandingInput,
  type StandingPreview,
  type StandingRuleRow,
} from "@/lib/standing-actions";

const HORIZONS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: MAX_STANDING_AHEAD_DAYS, label: "6 months" },
] as const;
const MAX_TIMES = 4;

const weekdayList = (days: number[]) => days.map((n) => WEEKDAYS.find((w) => w.n === n)?.short ?? "").filter(Boolean).join(", ");
const horizonLabel = (days: number) => HORIZONS.find((h) => h.days === days)?.label ?? `${days} days`;

const addMinutes = (t: string, mins: number) => {
  const m = ((Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Standing listing (2026-11-24): a tour kept open for registration without marking each day. Pick weekdays and start
 * times; runs are made now and kept made up to six months ahead. They are ordinary runs: the tour's minimum to run and
 * the guide's run-or-cancel decision apply. An overlap with the guide's other runs is shown and does not block.
 * Stopping keeps the runs already made (with their bookings); "Stop and remove empty runs" also deletes the unbooked ones.
 */
export function StandingPanel({ sheet, initialTourId }: { sheet: ScheduleSheet; initialTourId: string }) {
  const router = useRouter();
  const [tourId, setTourId] = React.useState(initialTourId || sheet.tours[0]?.id || "");
  const [weekdays, setWeekdays] = React.useState<number[]>([6]);
  const [times, setTimes] = React.useState<string[]>(["10:00"]);
  const [places, setPlaces] = React.useState(8);
  const [ahead, setAhead] = React.useState<number>(90);
  const [until, setUntil] = React.useState("");
  const [guideId, setGuideId] = React.useState("");
  const [preview, setPreview] = React.useState<StandingPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [rules, setRules] = React.useState<StandingRuleRow[]>([]);

  const input: StandingInput | null = React.useMemo(
    () =>
      tourId && weekdays.length > 0 && times.length > 0
        ? { tourId, weekdays, times, maxPlaces: places, aheadDays: ahead, validUntil: until || null, guideUserId: sheet.isOwner ? guideId || null : sheet.selfGuideId }
        : null,
    [tourId, weekdays, times, places, ahead, until, guideId, sheet.isOwner, sheet.selfGuideId],
  );

  const loadRules = React.useCallback(async () => {
    const r = await listStandingRules().catch(() => null);
    if (r?.ok) setRules(r.rules);
  }, []);
  React.useEffect(() => {
    void loadRules();
  }, [loadRules]);

  // Preview (debounced); a late answer for an older form is dropped.
  const seq = React.useRef(0);
  React.useEffect(() => {
    if (!input) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await previewStandingRule(input).catch(() => null);
      if (mine !== seq.current) return;
      if (r?.ok) {
        setPreview(r.preview);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(r ? r.error : "Could not work out the runs.");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [input]);

  async function save() {
    if (!input) return;
    setBusy(true);
    const r = await saveStandingRule(input).catch(() => ({ ok: false as const, error: "Could not save the standing listing." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Open for registration: ${r.created} run${r.created === 1 ? "" : "s"} made through ${formatDay(r.through, { day: "numeric", month: "short", year: "numeric" })}.`);
    await loadRules();
    router.refresh();
  }

  async function stop(rule: StandingRuleRow, removeEmpty: boolean) {
    if (removeEmpty && !window.confirm(`Delete the ${rule.upcoming} upcoming run${rule.upcoming === 1 ? "" : "s"} of ${rule.tourTitle} that nobody has booked? Runs with a booking stay.`)) return;
    setBusy(true);
    const r = await stopStandingRule(rule.id, { removeEmpty }).catch(() => ({ ok: false as const, error: "Could not stop it." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(removeEmpty ? `Stopped; ${r.removed} empty run${r.removed === 1 ? "" : "s"} removed.` : "Stopped. Runs already made stay.");
    await loadRules();
    router.refresh();
  }

  const toggleWeekday = (n: number) => setWeekdays((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n].sort()));
  const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";
  const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <p className="text-muted-foreground">
          Keep a tour open for registration on certain weekdays without marking each day. Runs are made ahead of time and topped up as days pass. The tour's minimum to run still applies to each run.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <label className="block">
            <span className={label}>Tour</span>
            <select value={tourId} onChange={(e) => setTourId(e.target.value)} className={field}>
              {sheet.tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.published ? "" : " (draft)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Places</span>
            <input type="number" min={1} max={500} value={places} onChange={(e) => setPlaces(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className={field} />
          </label>
          {sheet.guides ? (
            <label className="block sm:col-span-2">
              <span className={label}>Guide</span>
              <select value={guideId} onChange={(e) => setGuideId(e.target.value)} className={field}>
                <option value="">Tour's author</option>
                {sheet.guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2">You lead these runs.</p>
          )}
        </div>

        <div>
          <span className={label}>Days</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.n}
                type="button"
                aria-pressed={weekdays.includes(w.n)}
                onClick={() => toggleWeekday(w.n)}
                className={`rounded-md border px-3 py-1.5 ${weekdays.includes(w.n) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent/60"}`}
              >
                {w.short}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Start times (Paris)</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-background pl-2">
                <input
                  type="time"
                  step={900}
                  value={t}
                  onChange={(e) => e.target.value && setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                  className="bg-transparent py-1 tabular-nums"
                  aria-label="Start time (Paris)"
                />
                <button
                  type="button"
                  disabled={times.length <= 1}
                  onClick={() => setTimes(times.filter((_, j) => j !== i))}
                  className="px-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  aria-label="Remove this start time"
                >
                  ✕
                </button>
              </span>
            ))}
            {times.length < MAX_TIMES && (
              <button
                type="button"
                onClick={() => setTimes([...times, addMinutes(times[times.length - 1] ?? "10:00", 180)])}
                className="rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                + start time
              </button>
            )}
          </div>
        </div>

        <div>
          <span className={label}>Keep runs open</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {HORIZONS.map((h) => (
              <button
                key={h.days}
                type="button"
                aria-pressed={ahead === h.days}
                onClick={() => setAhead(h.days)}
                className={`rounded-md border px-3 py-1.5 ${ahead === h.days ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent/60"}`}
              >
                {h.label} ahead
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={label}>Ends on (optional)</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={field} />
        </label>

        <div className="rounded-md border border-border p-3" aria-live="polite">
          {previewError ? (
            <p className="text-destructive">{previewError}</p>
          ) : !preview ? (
            <p className="text-muted-foreground">Pick days and a start time.</p>
          ) : (
            <>
              <p>
                {preview.runs} run{preview.runs === 1 ? "" : "s"} now
                {preview.through ? `, through ${formatDay(preview.through, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                {preview.existing ? ` · ${preview.existing} already there` : ""}.
              </p>
              {preview.clashes > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">
                  {preview.clashes} overlap{preview.clashes === 1 ? "s" : ""} another run of the same guide and will still be made. {preview.clashSamples.join(" · ")}
                </p>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          disabled={busy || !input || (preview != null && preview.runs === 0 && preview.existing === 0)}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40"
        >
          {busy ? "Saving…" : "Open for registration"}
        </button>
      </div>

      <section aria-label="Standing listings">
        <h3 className={label}>Standing listings</h3>
        {rules.length === 0 ? (
          <p className="mt-2 text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {rules.map((r) => (
              <li key={r.id} className="space-y-1.5 px-3 py-3">
                <p className="font-medium">{r.tourTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {weekdayList(r.weekdays)} · {r.times.join(", ")} · {r.capacity} places · {horizonLabel(r.aheadDays)} ahead
                  {r.validUntil ? ` · until ${formatDay(r.validUntil, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  {r.guideName ? ` · ${r.guideName}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{r.upcoming} upcoming run{r.upcoming === 1 ? "" : "s"}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => stop(r, false)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/60">
                    Stop
                  </button>
                  <button type="button" disabled={busy} onClick={() => stop(r, true)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/60">
                    Stop and remove empty runs
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
