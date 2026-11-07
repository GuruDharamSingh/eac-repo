"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TourDeparture } from "@elkdonis/commerce/server";
import { cancelDepartureAction, saveDepartureAction } from "@/lib/tour-actions";
import { formatDeparture, toParisInput } from "@/lib/tour-format";
import { addDays, formatDay, parisTimeOf } from "@/lib/schedule-plan";
import { Button, Input, Label } from "@elkdonis/primitives";

export type PlannerDeparture = TourDeparture & {
  tourTitle: string;
  tourSlug: string;
  /** Paris calendar day, YYYY-MM-DD. */
  day: string;
  /** Who leads it when no guide is set. */
  authorName: string | null;
};

interface Guide { id: string; name: string; role: string }
interface TourOption { id: string; title: string; status: string }

interface Props {
  monday: string;
  today: string;
  departures: PlannerDeparture[];
  tours: TourOption[];
  guides: Guide[];
}

type Open = { kind: "departure"; id: string } | { kind: "new"; day: string } | null;

/**
 * The week, Monday to Sunday: seven columns on a wide screen, a day list on a
 * phone. A departure opens a side panel to edit or cancel it; the + on a day
 * still to come opens the same panel to add one.
 */
export function SchedulePlanner({ monday, today, departures, tours, guides }: Props) {
  const [open, setOpen] = useState<Open>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const selected = open?.kind === "departure" ? departures.find((d) => d.id === open.id) ?? null : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="grid gap-px border border-border bg-border lg:grid-cols-7">
        {days.map((day) => {
          const list = departures.filter((d) => d.day === day);
          const isPast = day < today;
          const isToday = day === today;
          return (
            <div key={day} className={`flex flex-col bg-background lg:min-h-[14rem] ${isPast ? "opacity-70" : ""}`}>
              <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${isToday ? "border-primary" : "border-border"}`}>
                <span className={`font-mono text-xs uppercase tracking-widest ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {formatDay(day)}
                </span>
                {!isPast && tours.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpen({ kind: "new", day })}
                    className="px-1.5 text-base leading-none text-muted-foreground hover:text-primary"
                    aria-label={`Add a departure on ${formatDay(day, { weekday: "long", day: "numeric", month: "long" })}`}
                    title="Add a departure"
                  >
                    +
                  </button>
                )}
              </div>
              <ul className="flex flex-1 flex-col gap-1.5 p-2">
                {list.length === 0 && (
                  <li className="px-1 py-1 text-xs text-muted-foreground/70 lg:hidden">Nothing scheduled</li>
                )}
                {list.map((d) => (
                  <li key={d.id}>
                    <DepartureCard d={d} active={open?.kind === "departure" && open.id === d.id} onOpen={() => setOpen({ kind: "departure", id: d.id })} />
                  </li>
                ))}
                {!isPast && tours.length > 0 && (
                  <li className="mt-auto hidden lg:block">
                    <button
                      type="button"
                      onClick={() => setOpen({ kind: "new", day })}
                      className="w-full border border-dashed border-transparent py-2 text-xs text-muted-foreground/0 hover:border-border hover:text-muted-foreground"
                      tabIndex={-1}
                    >
                      + Add
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={open.kind === "new" ? "Add a departure" : "Departure"}>
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setOpen(null)} />
          <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6 shadow-xl">
            <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-4 text-sm text-muted-foreground hover:text-foreground">Close</button>
            {open.kind === "new" ? (
              <NewDeparture key={open.day} day={open.day} tours={tours} guides={guides} onDone={() => setOpen(null)} />
            ) : selected ? (
              <DepartureDetail key={selected.id} d={selected} guides={guides} onDone={() => setOpen(null)} />
            ) : (
              <p className="text-sm text-muted-foreground">That departure is no longer in this week.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function DepartureCard({ d, active, onOpen }: { d: PlannerDeparture; active: boolean; onOpen: () => void }) {
  const cancelled = d.status === "cancelled";
  const full = !cancelled && d.seatsLeft === 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full border-l-2 px-2.5 py-2 text-left text-sm transition-colors ${
        cancelled ? "border-border bg-muted/40 text-muted-foreground" : "border-primary bg-card hover:bg-accent/60"
      } ${active ? "ring-1 ring-ring" : ""}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={`font-medium tabular-nums ${cancelled ? "line-through" : ""}`}>{parisTimeOf(d.startsAt)}</span>
        <span className={`text-xs tabular-nums ${full ? "text-primary" : "text-muted-foreground"}`}>
          {cancelled ? "cancelled" : full ? "full" : `${d.seatsTaken}/${d.capacity}`}
        </span>
      </span>
      <span className={`mt-0.5 block leading-snug ${cancelled ? "line-through" : ""}`}>{d.tourTitle}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{d.guideName ?? d.authorName ?? "Tour's author"}</span>
    </button>
  );
}

function GuideSelect({ id, value, onChange, guides }: { id: string; value: string; onChange: (v: string) => void; guides: Guide[] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
      <option value="">Tour's author</option>
      {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );
}

function DepartureDetail({ d, guides, onDone }: { d: PlannerDeparture; guides: Guide[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startsAt, setStartsAt] = useState(toParisInput(d.startsAt));
  const [capacity, setCapacity] = useState(d.capacity);
  const [guide, setGuide] = useState(d.guideUserId ?? "");
  const [note, setNote] = useState(d.note ?? "");
  const scheduled = d.status === "scheduled";

  function save() {
    start(async () => {
      const r = await saveDepartureAction(d.threadId, { startsAt, capacity, guideUserId: guide, note }, d.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Departure saved");
      router.refresh();
      onDone();
    });
  }
  function cancel() {
    const msg = prompt(`Cancel this departure? ${d.confirmedBookings} booking(s) will be told. Optional note to them:`);
    if (msg === null) return;
    start(async () => {
      const r = await cancelDepartureAction(d.id, msg);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.notified ? `Cancelled; ${r.notified} emailed` : "Cancelled");
      router.refresh();
      onDone();
    });
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{scheduled ? "Departure" : "Cancelled departure"}</p>
      <h3 className={`mt-1 pr-12 font-serif text-xl ${scheduled ? "" : "line-through"}`}>{d.tourTitle}</h3>
      <p className="mt-1 text-sm">{formatDeparture(d.startsAt, { withYear: true })}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {d.seatsTaken}/{d.capacity} places taken · {d.confirmedBookings} confirmed booking{d.confirmedBookings === 1 ? "" : "s"} · {d.guideName ?? d.authorName ?? "Tour's author"}
      </p>
      {d.note && <p className="mt-1 text-sm text-muted-foreground">Note: {d.note}</p>}

      <p className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href={`/manage/tours/${d.threadId}?tab=departures`} className="underline underline-offset-4">Departures & manifest</Link>
        <Link href={`/tours/${d.tourSlug}`} className="underline underline-offset-4">Tour page</Link>
      </p>

      {scheduled && (
        <div className="mt-6 space-y-3 border-t border-border pt-5">
          <div>
            <Label htmlFor="sp-starts">Starts (Paris)</Label>
            <Input id="sp-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div>
              <Label htmlFor="sp-cap">Places</Label>
              <Input id="sp-cap" type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sp-guide">Guide</Label>
              <GuideSelect id="sp-guide" value={guide} onChange={setGuide} guides={guides} />
            </div>
          </div>
          <div>
            <Label htmlFor="sp-note">Note <span className="text-muted-foreground">(shown to the guide only)</span></Label>
            <Input id="sp-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={save} disabled={pending}>Save</Button>
            <Button type="button" variant="ghost" className="text-destructive" onClick={cancel} disabled={pending}>Cancel departure</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewDeparture({ day, tours, guides, onDone }: { day: string; tours: TourOption[]; guides: Guide[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tourId, setTourId] = useState(tours[0]?.id ?? "");
  const [time, setTime] = useState("10:00");
  const [capacity, setCapacity] = useState(8);
  const [guide, setGuide] = useState(guides[0]?.id ?? "");

  function add() {
    start(async () => {
      const r = await saveDepartureAction(tourId, { startsAt: `${day}T${time}`, capacity, guideUserId: guide });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Departure added");
      router.refresh();
      onDone();
    });
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Add a departure</p>
      <h3 className="mt-1 pr-12 font-serif text-xl">{formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
      <div className="mt-5 space-y-3">
        <div>
          <Label htmlFor="nd-tour">Tour</Label>
          <select id="nd-tour" value={tourId} onChange={(e) => setTourId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {tours.map((t) => <option key={t.id} value={t.id}>{t.title}{t.status === "published" ? "" : " (draft)"}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-[7rem_6rem_1fr] gap-3">
          <div>
            <Label htmlFor="nd-time">Time (Paris)</Label>
            <Input id="nd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="nd-cap">Places</Label>
            <Input id="nd-cap" type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="nd-guide">Guide</Label>
            <GuideSelect id="nd-guide" value={guide} onChange={setGuide} guides={guides} />
          </div>
        </div>
        <Button type="button" onClick={add} disabled={pending || !tourId || !time}>Add departure</Button>
      </div>
    </div>
  );
}
