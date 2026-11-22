"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { Sheet, roman } from "@/components/mobile";
import { FormTop, clockLabel, dayLabel } from "./board-bits";
import { inviteForDepartureAction, linkExperienceToStopAction } from "@/lib/collaborate-actions";

// Screen 36, Collaborate (G7b). Per tour: the stops with their linked experience and one chip per upcoming date.
// Link and unlink go through linkExperienceToStopAction (it invites the artist for every date they are free and
// reports invited and skippedNotFree). "+ Invite" calls inviteForDepartureAction. Fixed copy.

export interface CollabStop {
  stopId: string;
  position: number;
  title: string;
  offsetMinutes: number;
  experience: { id: string; title: string; artistName: string | null } | null;
  dates: Array<{ departureId: string; startsAt: string; arrivalAt: string; state: "confirmed" | "asked" | "declined" | "free" | "not_free" }>;
}
export interface CollabCandidate {
  id: string;
  title: string;
  artistName: string | null;
  place: string | null;
  /** Per stop id: how many of the upcoming dates the artist is free for. */
  free: Record<string, number>;
}

const CHIP_LABEL = { confirmed: "Confirmed", asked: "Asked", declined: "Declined", free: "+ Invite", not_free: "Not free" } as const;

function offsetLabel(min: number): string {
  if (!min) return "Start";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `+${h ? `${h} h ` : ""}${m ? `${m} min` : ""}`.trim();
}

export function CollaborateView({
  tours,
  tourId,
  stops,
  candidates,
  dateCount,
}: {
  tours: Array<{ id: string; title: string }>;
  tourId: string;
  stops: CollabStop[];
  candidates: CollabCandidate[];
  dateCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheetStop, setSheetStop] = useState<CollabStop | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const link = (stop: CollabStop, experienceId: string | null) => {
    setBusy(stop.stopId);
    start(async () => {
      const r = await linkExperienceToStopAction(stop.stopId, experienceId);
      setBusy(null);
      if (!r.ok) return void failToast(r.error);
      setSheetStop(null);
      if (experienceId === null) toast.success("Taken off this stop.");
      else if (r.invited > 0) toast.success(`Added. The artist is asked for ${r.invited} ${r.invited > 1 ? "dates" : "date"}.`);
      else toast.success(r.skippedNotFree > 0 ? "Added. The artist is not free on the current dates." : "Added.");
      router.refresh();
    });
  };

  const invite = (stop: CollabStop, departureId: string) => {
    setBusy(`${stop.stopId}:${departureId}`);
    start(async () => {
      const r = await inviteForDepartureAction(stop.stopId, departureId);
      setBusy(null);
      if (!r.ok) return void failToast(r.error);
      toast.success("Asked.");
      router.refresh();
    });
  };

  return (
    <div className="bf">
      <FormTop href={`/manage/tours/${tourId}`} kicker="Collaborate" title={tours.find((t) => t.id === tourId)?.title ?? "Tour"} />
      {tours.length > 1 && (
        <div className="m-chip-row" style={{ marginTop: 16 }}>
          {tours.map((t) => (
            <Link key={t.id} href={`/manage/tours/${t.id}/collaborate`} className={`m-chip${t.id === tourId ? " is-selected" : ""}`} style={{ textDecoration: "none" }}>
              {t.title}
            </Link>
          ))}
        </div>
      )}
      <div className="bf-body">
        <p className="bf-sub">Put an artist&apos;s experience on a stop. They are asked for each date they are free, at the time the group arrives.</p>
        {dateCount === 0 && <p className="bf-note">No upcoming dates yet. Artists are asked once the tour has dates.</p>}

        {stops.map((s, i) => (
          <div key={s.stopId} className="bf-stop">
            <div className="bf-stop-head">
              <span className="bf-stop-num">{roman(i + 1)}</span>
              <span className="bf-stop-name">{s.title}</span>
              <span className="bf-stop-off">{offsetLabel(s.offsetMinutes)}</span>
            </div>
            {s.experience ? (
              <>
                <div className="bf-stop-exp">
                  <span>{s.experience.title}</span>
                  <small>{s.experience.artistName ?? "No artist set"}</small>
                </div>
                <div className="bf-chips">
                  {s.dates.map((d) => {
                    const label = `${dayLabel(d.startsAt)} · ${clockLabel(d.arrivalAt)}`;
                    const key = `${s.stopId}:${d.departureId}`;
                    return (
                      <button
                        key={d.departureId}
                        type="button"
                        className="bf-dchip"
                        data-state={d.state}
                        disabled={d.state !== "free" || busy === key || pending}
                        onClick={() => invite(s, d.departureId)}
                      >
                        <span>{label}</span>
                        <b>{CHIP_LABEL[d.state]}</b>
                      </button>
                    );
                  })}
                </div>
                <div className="bf-actions">
                  <button type="button" className="bf-btn-line" disabled={pending} onClick={() => setSheetStop(s)}>Change</button>
                  <button type="button" className="bf-btn-line" disabled={pending} onClick={() => link(s, null)}>Take off</button>
                </div>
              </>
            ) : (
              <button type="button" className="bf-dashed" onClick={() => setSheetStop(s)}>+ Add an experience</button>
            )}
          </div>
        ))}
        {stops.length === 0 && <p className="bf-note">This tour has no stops yet. Add them in the tour builder first.</p>}
      </div>

      <Sheet open={sheetStop !== null} onOpenChange={(o) => !o && setSheetStop(null)} tall title="Add an experience">
        <div className="bf-media">
          <p className="bf-note">Public experiences only. Choosing one asks the artist for every date they are free.</p>
          {sheetStop && candidates.length === 0 && <p className="bf-note">No public experiences yet.</p>}
          {sheetStop &&
            candidates.map((c) => {
              const free = c.free[sheetStop.stopId] ?? 0;
              return (
                <button key={c.id} type="button" className="bf-pick" disabled={pending} onClick={() => link(sheetStop, c.id)}>
                  <span>{c.title}</span>
                  <small>{[c.artistName, c.place].filter(Boolean).join(" · ")}</small>
                  <small className={free ? "is-good" : undefined}>{dateCount ? `Free for ${free} of ${dateCount} dates` : "No dates scheduled yet"}</small>
                </button>
              );
            })}
        </div>
      </Sheet>
    </div>
  );
}
