"use client";

import * as React from "react";
import { toast } from "sonner";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { getAvailabilitySheet, saveAvailabilityDaysAction, type AvailabilityDay, type AvailabilitySheet, type DayPart, type Offer } from "@/lib/availability-actions";
import { formatDay } from "@/lib/schedule-plan";

/** The hub card's descriptor (registered as `office-availability` in HubSurfaces). */
export const availabilityDescriptor: SurfaceDescriptor = {
  type: "custom",
  key: "office-availability",
  title: "Offer availability",
  kind: "event",
  size: "wide",
};

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PARTS: Array<[DayPart, string]> = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
];
const OFFERS: Array<[Offer, string]> = [
  ["guide", "Guide a tour"],
  ["experience", "Host an experience"],
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

/**
 * Offer availability (hub, 2026-11-19): click the days ahead you are free; each becomes a row where you say which
 * part of the day (none picked = all day), whether you can guide or host an experience, and a note. "Save and tell
 * the office" emails the owners the new or changed days. Owners also see everyone's offered days below.
 */
export function AvailabilityPopup(_props: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const [sheet, setSheet] = React.useState<AvailabilitySheet | null>(null);
  const [days, setDays] = React.useState<AvailabilityDay[]>([]);
  const [month, setMonth] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const load = React.useCallback(async () => {
    const s = await getAvailabilitySheet().catch(() => null);
    if (!s) return void toast.error("Could not load your days.");
    setSheet(s);
    setDays(s.mine);
    setMonth((m) => m || s.today.slice(0, 7));
    setDirty(false);
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (!sheet) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Offer availability">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  const picked = new Set(days.map((d) => d.day));
  const toggle = (day: string) => {
    setDirty(true);
    setDays((list) => (picked.has(day) ? list.filter((d) => d.day !== day) : [...list, { day, parts: [] as DayPart[], offers: ["guide"] as Offer[], note: null }].sort((a, b) => a.day.localeCompare(b.day))));
  };
  const patch = (day: string, p: Partial<AvailabilityDay>) => {
    setDirty(true);
    setDays((list) => list.map((d) => (d.day === day ? { ...d, ...p } : d)));
  };
  const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save(alert: boolean) {
    setBusy(true);
    const r = await saveAvailabilityDaysAction(days, alert).catch(() => ({ ok: false as const, error: "Could not save your days." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    toast.success(alert ? (r.emailed ? `Saved; the office was emailed (${r.emailed}).` : "Saved. Nothing new to tell the office.") : "Saved");
    await load();
  }

  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7));
  const others = sheet.team ?? [];
  const teamByDay = new Map<string, number>();
  for (const t of sheet.team ?? []) teamByDay.set(t.day, (teamByDay.get(t.day) ?? 0) + 1);

  const actions: SurfaceAction[] = [
    { label: busy ? "Saving…" : "Save", quiet: true, disabled: busy || !dirty, onClick: () => save(false) },
    { label: busy ? "Saving…" : "Save and tell the office", primary: true, disabled: busy, onClick: () => save(true) },
  ];

  return (
    <SurfaceFrame kind="event" kicker="Office" title="Offer availability" actions={actions} status={`${days.length} day${days.length === 1 ? "" : "s"} offered${dirty ? " · not saved" : ""}`}>
      <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Calendar" className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-serif text-lg">{monthName}</span>
            <span className="flex gap-1">
              <button type="button" className="rounded px-2 py-1 hover:bg-accent disabled:opacity-30" disabled={month <= sheet.today.slice(0, 7)} onClick={() => shift(-1)} aria-label="Earlier month">‹</button>
              <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => shift(1)} aria-label="Later month">›</button>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK.map((w) => (
              <span key={w} className="pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{w}</span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={i} />;
              const past = day < sheet.today;
              const on = picked.has(day);
              const team = teamByDay.get(day) ?? 0;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  aria-pressed={on}
                  onClick={() => toggle(day)}
                  className={`relative h-11 rounded-md border tabular-nums ${on ? "border-primary bg-primary text-primary-foreground" : past ? "border-transparent text-muted-foreground/40" : "border-transparent hover:border-border hover:bg-accent/60"}`}
                >
                  {Number(day.slice(8))}
                  {sheet.team && team > 0 && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${on ? "bg-primary-foreground" : "bg-muted-foreground/60"}`} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Click the days you are free.{sheet.team ? " Dots: someone on the team offered that day." : ""}</p>
        </section>

        <section aria-label="Your days" className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your days</h3>
          {days.length === 0 ? (
            <p className="text-muted-foreground">No days offered yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {days.map((d) => (
                <li key={d.day} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatDay(d.day, { weekday: "short", day: "numeric", month: "short" })}</span>
                    <button type="button" onClick={() => toggle(d.day)} className="px-2 text-muted-foreground hover:text-destructive" aria-label="Remove this day">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip on={d.parts.length === 0} onClick={() => patch(d.day, { parts: [] })}>All day</Chip>
                    {PARTS.map(([k, l]) => (
                      <Chip key={k} on={d.parts.includes(k)} onClick={() => patch(d.day, { parts: flip(d.parts, k) })}>{l}</Chip>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {OFFERS.map(([k, l]) => (
                      <Chip key={k} on={d.offers.includes(k)} onClick={() => patch(d.day, { offers: flip(d.offers, k).length ? flip(d.offers, k) : d.offers })}>{l}</Chip>
                    ))}
                  </div>
                  <input value={d.note ?? ""} onChange={(e) => patch(d.day, { note: e.target.value || null })} placeholder="Note (optional): from 14:00, Montmartre only…" className="w-full rounded-md border border-input bg-background px-2 py-1.5" />
                </li>
              ))}
            </ul>
          )}

          {sheet.team && others.length > 0 && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer select-none font-medium">The team's days ({others.length})</summary>
              <ul className="mt-2 space-y-1">
                {others.map((t) => (
                  <li key={`${t.userId}:${t.day}`} className="flex flex-wrap gap-x-2">
                    <span className="w-24 shrink-0 tabular-nums">{formatDay(t.day, { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground">
                      {t.parts.length ? t.parts.join(", ") : "all day"} · {t.offers.map((o) => (o === "guide" ? "guide" : "experience")).join(", ")}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </SurfaceFrame>
  );
}
