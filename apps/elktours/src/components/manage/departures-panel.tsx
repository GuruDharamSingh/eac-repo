"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TourBooking, TourDeparture } from "@elkdonis/commerce/server";
import { addDeparturesAction, cancelBookingAction, cancelDepartureAction, saveDepartureAction } from "@/lib/tour-actions";
import { formatDeparture, toParisInput } from "@/lib/tour-format";
import { Button, Input, Label } from "@elkdonis/primitives";

interface Guide { id: string; name: string; role: string }

interface Props {
  tourId: string;
  departures: TourDeparture[];
  guides: Guide[];
  manifests: Record<string, TourBooking[]>;
}

/**
 * Dated runs of the tour. Add several at once (same time on each chosen
 * day), edit one, cancel one (its buyers are emailed), and read each run's
 * manifest.
 */
export function DeparturesPanel({ tourId, departures, guides, manifests }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState("");
  const [time, setTime] = useState("10:00");
  const [capacity, setCapacity] = useState(8);
  const [guide, setGuide] = useState(guides[0]?.id ?? "");

  const now = Date.now();
  const upcoming = departures.filter((d) => new Date(d.startsAt).getTime() >= now - 6 * 3600_000);
  const past = departures.filter((d) => new Date(d.startsAt).getTime() < now - 6 * 3600_000);

  function add() {
    const dates = days.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    start(async () => {
      const r = await addDeparturesAction(tourId, { dates, time, capacity, guideUserId: guide || null });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.added} departure${r.added === 1 ? "" : "s"} added`);
      setDays("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      <section className="border border-border bg-card p-5">
        <h3 className="font-medium">Add departures</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem_7rem_12rem]">
          <div>
            <Label htmlFor="days">Days <span className="text-muted-foreground">(YYYY-MM-DD, several separated by spaces)</span></Label>
            <Input id="days" value={days} onChange={(e) => setDays(e.target.value)} placeholder="2026-11-07 2026-11-14 2026-11-21" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="time">Time (Paris)</Label>
            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cap">Places</Label>
            <Input id="cap" type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="guide">Guide</Label>
            <select id="guide" value={guide} onChange={(e) => setGuide(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Tour's author</option>
              {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <Button type="button" className="mt-3" onClick={add} disabled={pending || !days.trim()}>Add</Button>
      </section>

      <section>
        <h3 className="font-medium">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming departures. Visitors cannot book until there is one.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {upcoming.map((d) => (
              <DepartureRow key={d.id} d={d} guides={guides} manifest={manifests[d.id] ?? []} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h3 className="font-medium text-muted-foreground">Past</h3>
          <ul className="mt-3 divide-y divide-border border border-border opacity-80">
            {past.slice(-20).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <span>{formatDeparture(d.startsAt, { withYear: true })}</span>
                <span className="text-muted-foreground">{d.seatsTaken}/{d.capacity} · {d.status}</span>
                {(manifests[d.id]?.length ?? 0) > 0 && <Manifest rows={manifests[d.id]!} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DepartureRow({ d, guides, manifest }: { d: TourDeparture; guides: Guide[]; manifest: TourBooking[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [startsAt, setStartsAt] = useState(toParisInput(d.startsAt));
  const [capacity, setCapacity] = useState(d.capacity);
  const [guide, setGuide] = useState(d.guideUserId ?? "");
  const [note, setNote] = useState(d.note ?? "");

  function save() {
    start(async () => {
      const r = await saveDepartureAction(d.threadId, { startsAt, capacity, guideUserId: guide, note }, d.id);
      if (!r.ok) return void toast.error(r.error);
      setEditing(false);
      router.refresh();
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
    });
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className={d.status === "cancelled" ? "line-through" : "font-medium"}>{formatDeparture(d.startsAt, { withYear: true })}</span>
        <span className="text-muted-foreground">
          {d.seatsTaken}/{d.capacity} places taken{d.guideName ? ` · ${d.guideName}` : ""}{d.status === "cancelled" ? " · cancelled" : ""}
        </span>
        {d.note && <span className="text-muted-foreground">· {d.note}</span>}
        {d.status === "scheduled" && (
          <span className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit"}</Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={cancel}>Cancel</Button>
          </span>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem_10rem_1fr_auto]">
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} />
          <select value={guide} onChange={(e) => setGuide(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Tour's author</option>
            {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (shown to the guide only)" />
          <Button type="button" size="sm" disabled={pending} onClick={save}>Save</Button>
        </div>
      )}
      {manifest.length > 0 && <Manifest rows={manifest} />}
    </li>
  );
}

function Manifest({ rows }: { rows: TourBooking[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const confirmed = rows.filter((b) => b.status === "confirmed");
  const people = confirmed.reduce((n, b) => n + b.partySize, 0);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Manifest: {confirmed.length} booking{confirmed.length === 1 ? "" : "s"}, {people} {people === 1 ? "person" : "people"}
      </summary>
      <table className="mt-2 w-full text-xs">
        <tbody className="divide-y divide-border">
          {rows.map((b) => (
            <tr key={b.id} className={b.status === "cancelled" ? "text-muted-foreground line-through" : ""}>
              <td className="py-1 pr-3">{b.buyerName ?? "—"}</td>
              <td className="py-1 pr-3"><a href={`mailto:${b.buyerEmail}`} className="underline">{b.buyerEmail}</a></td>
              <td className="py-1 pr-3">{b.partySize}</td>
              <td className="py-1 pr-3">{b.orderNumber ?? ""}</td>
              <td className="py-1 pr-3">{b.note ?? ""}</td>
              <td className="py-1 text-right">
                {b.status === "confirmed" && (
                  <button
                    type="button"
                    className="text-destructive underline"
                    disabled={pending}
                    onClick={() => {
                      const msg = prompt("Cancel this booking? The buyer will be told. Optional note:");
                      if (msg === null) return;
                      start(async () => {
                        const r = await cancelBookingAction(b.id, msg);
                        if (!r.ok) toast.error(r.error); else router.refresh();
                      });
                    }}
                  >
                    cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
