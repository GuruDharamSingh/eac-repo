"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createScheduleAction, previewScheduleAction, type RepeatScheduleValues } from "@/lib/schedule-actions";
import { addDays, formatDay, MAX_SCHEDULE_BATCH, WEEKDAYS, type RepeatPlan } from "@/lib/schedule-plan";
import { Button, Input, Label } from "@elkdonis/primitives";

interface Guide { id: string; name: string; role: string }
interface TourOption { id: string; title: string; status: string }

const STATUS_LABEL = { new: "", exists: "already scheduled", past: "past", over_cap: "over this run's limit" } as const;

/**
 * Repeat one tour on chosen weekdays and times across a date range. Preview
 * lists every slot and what will happen to it; Create re-plans on the server
 * and writes only the new ones (at most MAX_SCHEDULE_BATCH per run).
 */
export function RepeatScheduler({ tours, guides, defaultFrom }: { tours: TourOption[]; guides: Guide[]; defaultFrom: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tourId, setTourId] = useState(tours[0]?.id ?? "");
  const [weekdays, setWeekdays] = useState<number[]>([6]);
  const [times, setTimes] = useState<string[]>(["10:00"]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(addDays(defaultFrom, 27));
  const [capacity, setCapacity] = useState(8);
  const [guide, setGuide] = useState(guides[0]?.id ?? "");
  const [plan, setPlan] = useState<RepeatPlan | null>(null);

  const values: RepeatScheduleValues = { tourId, weekdays, times, from, to, capacity, guideUserId: guide };

  // Any change to the request makes the shown preview stale.
  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPlan(null);
    };
  }
  const toggleDay = (n: number) => edit(setWeekdays)(weekdays.includes(n) ? weekdays.filter((x) => x !== n) : [...weekdays, n].sort());

  function preview() {
    start(async () => {
      const r = await previewScheduleAction(values);
      if (!r.ok) return void toast.error(r.error);
      setPlan(r.plan);
    });
  }
  function create() {
    if (!plan || plan.creatable === 0) return;
    start(async () => {
      const r = await createScheduleAction(values);
      if (!r.ok) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      toast.success(`${r.added} departure${r.added === 1 ? "" : "s"} created${r.overCap ? `; ${r.overCap} more remain, run it again` : ""}`);
      setPlan(null);
      router.refresh();
    });
  }

  if (tours.length === 0) return <p className="text-sm text-muted-foreground">Add a tour first.</p>;

  return (
    <div className="border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="rs-tour">Tour</Label>
          <select id="rs-tour" value={tourId} onChange={(e) => edit(setTourId)(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {tours.map((t) => <option key={t.id} value={t.id}>{t.title}{t.status === "published" ? "" : " (draft)"}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Weekdays</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {WEEKDAYS.map((w) => {
              const on = weekdays.includes(w.n);
              return (
                <button
                  key={w.n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(w.n)}
                  className={`min-w-[3rem] border px-2 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent/40"}`}
                >
                  {w.short}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Start times <span className="font-normal text-muted-foreground">(Paris)</span></legend>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <Input
                  type="time"
                  aria-label={`Start time ${i + 1}`}
                  value={t}
                  onChange={(e) => edit(setTimes)(times.map((x, j) => (j === i ? e.target.value : x)))}
                  className="w-[7.5rem]"
                />
                {times.length > 1 && (
                  <button type="button" onClick={() => edit(setTimes)(times.filter((_, j) => j !== i))} className="px-1 text-muted-foreground hover:text-destructive" aria-label={`Remove ${t}`}>×</button>
                )}
              </span>
            ))}
            {times.length < 8 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => edit(setTimes)([...times, "14:00"])}>+ time</Button>
            )}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rs-from">From</Label>
            <Input id="rs-from" type="date" value={from} onChange={(e) => edit(setFrom)(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="rs-to">To <span className="text-muted-foreground">(inclusive)</span></Label>
            <Input id="rs-to" type="date" value={to} min={from} onChange={(e) => edit(setTo)(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <div>
            <Label htmlFor="rs-cap">Places</Label>
            <Input id="rs-cap" type="number" min={1} max={500} value={capacity} onChange={(e) => edit(setCapacity)(Number(e.target.value) || 1)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="rs-guide">Guide</Label>
            <select id="rs-guide" value={guide} onChange={(e) => edit(setGuide)(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Tour's author</option>
              {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={preview} disabled={pending || !tourId || weekdays.length === 0}>Preview dates</Button>
        {plan && (
          <Button type="button" onClick={create} disabled={pending || plan.creatable === 0}>
            Create {plan.creatable} departure{plan.creatable === 1 ? "" : "s"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">At most {MAX_SCHEDULE_BATCH} per run.</span>
      </div>

      {plan && <PlanPreview plan={plan} />}
    </div>
  );
}

function PlanPreview({ plan }: { plan: RepeatPlan }) {
  if (plan.items.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No dates in that range fall on the chosen weekdays.</p>;
  }
  return (
    <div className="mt-4">
      <p className="text-sm">
        {plan.creatable} new
        {plan.existing ? ` · ${plan.existing} already scheduled` : ""}
        {plan.past ? ` · ${plan.past} past` : ""}
        {plan.overCap ? ` · ${plan.overCap} beyond the limit (run again after creating)` : ""}
      </p>
      <ul className="mt-2 grid max-h-80 gap-x-6 overflow-y-auto border border-border p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {plan.items.map((i) => (
          <li key={i.startsAt} className={`flex justify-between gap-3 py-0.5 tabular-nums ${i.status === "new" ? "" : "text-muted-foreground line-through"}`}>
            <span>{formatDay(i.day, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {i.time}</span>
            {i.status !== "new" && <span className="text-xs no-underline">{STATUS_LABEL[i.status]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
