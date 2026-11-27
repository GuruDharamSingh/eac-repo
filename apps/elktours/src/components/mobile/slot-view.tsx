"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import "@/blocks/mobile/flow.css";
import "./board.css";
import { BackButton, PrimaryButton } from "@/components/mobile";
import { getSlot, updateSlot, type ManifestRow } from "@/lib/slot-actions";
import type { BoardSlot } from "@/lib/tour-slots";
import { CUTOFFS, clock, dayKey, dayLong, dayShort, minutesLabel, toneColor } from "./board-ui";
import { SlotActions } from "./slot-actions-ui";

/** Words for a booking's status on the guest list; a confirmed booking needs none. */
function guestStatus(status: string): string | null {
  switch (status) {
    case "confirmed":
    case "completed":
      return null;
    case "awaiting_payment":
    case "held":
      return "Awaiting payment";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return status.replace(/_/g, " ");
  }
}
const isGone = (status: string) => status === "cancelled" || status === "expired";

const fmtDT = (iso: string) => `${dayShort(dayKey(iso))}, ${clock(iso)}`;

function leftIn(iso: string): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/** The status panel: a heading and one sentence per state (prototype wording, Slot state in data-and-state). */
function panel(slot: BoardSlot): { head: string; text: string } {
  const min = slot.minToRun;
  const n = slot.seatsTaken;
  const guests = `${n} ${n === 1 ? "guest is" : "guests are"} coming`;
  if (slot.status === "cancelled" || slot.stateKey === "cancelled") return { head: "Cancelled", text: "Guests were told by email." };
  switch (slot.stateKey) {
    case "below":
      return { head: "Below the minimum", text: `${n} of the ${min ?? "?"} needed had booked when booking closed (${fmtDT(slot.closesAt)}). It only goes ahead if you say so.` };
    case "open":
      return {
        head: "Booking is open",
        text: `Closes ${fmtDT(slot.closesAt)}, in ${leftIn(slot.closesAt)}.${min ? ` ${slot.shortBy > 0 ? `${slot.shortBy} more needed to reach the minimum of ${min}.` : `The minimum of ${min} is reached.`}` : ""}`,
      };
    case "confirmed":
      return slot.runDecision === "run" && min && n < min
        ? { head: "Running below minimum", text: `You chose to run it with ${n}. Guests have been told.` }
        : { head: "Confirmed", text: `Booking closed ${fmtDT(slot.closesAt)}. ${guests}.` };
    default:
      return { head: "Finished", text: "This slot has finished." };
  }
}

function closeBefore(slot: BoardSlot): number {
  return Math.max(0, Math.round((new Date(slot.startsAt).getTime() - new Date(slot.closesAt).getTime()) / 60000));
}

/** Next stepper value in a list of presets, from a value that may sit between them. */
function stepCut(value: number, dir: 1 | -1): number {
  const list = [0, 60, ...CUTOFFS];
  if (dir === 1) return list.find((v) => v > value) ?? value;
  return [...list].reverse().find((v) => v < value) ?? value;
}

function Stepper({ label, value, onMinus, onPlus, minusOff, plusOff }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusOff?: boolean; plusOff?: boolean }) {
  return (
    <div className="b-stepper">
      <span className="b-stepper-label">{label}</span>
      <span className="b-stepper-ctl">
        <button type="button" className="b-mini" aria-label={`Less ${label}`} disabled={minusOff} onClick={onMinus}>−</button>
        <span className="b-stepper-val">{value}</span>
        <button type="button" className="b-mini" aria-label={`More ${label}`} disabled={plusOff} onClick={onPlus}>+</button>
      </span>
    </div>
  );
}

/**
 * Screen 33, Slot. A page at /manage/schedule/[slotId] (a sheet would lose the URL the Board, Schedule and Decisions
 * cards link to). Status panel, decisions, booked count with seat ticks, slot settings, guest list.
 * The waitlist is off, so it is neither shown nor editable.
 */
export function SlotView({ initialSlot, initialManifest, overlaps = [] }: { initialSlot: BoardSlot; initialManifest: ManifestRow[]; overlaps?: Array<{ slotId: string; tourTitle: string; startsAt: string }> }) {
  const router = useRouter();
  const [slot, setSlot] = useState(initialSlot);
  const [manifest, setManifest] = useState(initialManifest);
  const [min, setMin] = useState(initialSlot.minToRun ?? 0);
  const [places, setPlaces] = useState(initialSlot.capacity);
  const [cut, setCut] = useState(closeBefore(initialSlot));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const live = slot.status === "scheduled" && slot.stateKey !== "past";
  const startCut = closeBefore(slot);
  const dirty = min !== (slot.minToRun ?? 0) || places !== slot.capacity || cut !== startCut;
  const attention = slot.tone === "attention";
  const pn = panel(slot);

  async function refresh() {
    const r = await getSlot(slot.slotId);
    if (r.ok) {
      setSlot(r.slot);
      setManifest(r.manifest);
      setMin(r.slot.minToRun ?? 0);
      setPlaces(r.slot.capacity);
      setCut(closeBefore(r.slot));
    }
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await updateSlot(slot.slotId, {
        ...(min !== (slot.minToRun ?? 0) ? { minToRun: min > 0 ? min : null } : {}),
        ...(places !== slot.capacity ? { capacity: places } : {}),
        ...(cut !== startCut ? { closeBeforeMinutes: cut } : {}),
      });
      if (!r.ok) {
        setSaveError(r.error);
        failToast(r.error);
        return;
      }
      toast.success("Slot saved.");
      await refresh();
    } catch {
      setSaveError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const key = dayKey(slot.startsAt);
  const kept = manifest.filter((g) => !isGone(g.status));
  const gone = manifest.filter((g) => isGone(g.status));
  const ticks = Math.min(slot.capacity, 60);

  return (
    <div className="b-page" style={{ ["--tone" as string]: toneColor(slot.tone), paddingBottom: 48 }}>
      <div className="b-top">
        <BackButton href="/manage/schedule" />
        <span className="m-kicker" style={{ color: "hsl(var(--muted-foreground))" }}>
          {dayLong(key)} · {clock(slot.startsAt)}
        </span>
      </div>
      <div className="b-head">
        <h1 className="b-title" style={{ fontSize: 34 }}>{slot.tourTitle}</h1>
        {slot.guide ? <span className="b-top-sub">With {slot.guide.name}</span> : null}
      </div>

      <div className={`b-panel${attention ? " is-attention" : ""}`}>
        <div className="b-panel-head">
          <span className="b-panel-dot" aria-hidden="true" />
          <span>{pn.head}</span>
        </div>
        <p className="b-panel-text">{pn.text}</p>
      </div>

      {overlaps.length > 0 && slot.status === "scheduled" ? (
        <p className="b-note is-warn" role="status">
          Overlaps{" "}
          {overlaps.map((o, i) => (
            <span key={o.slotId}>
              {i ? ", " : ""}
              <Link href={`/manage/schedule/${o.slotId}`} style={{ color: "inherit", textDecoration: "underline" }}>
                {o.tourTitle} at {clock(o.startsAt)}
              </Link>
            </span>
          ))}
          , another run of the same guide.
        </p>
      ) : null}

      <SlotActions slot={slot} onChanged={refresh} />

      <div className="b-booked">
        <span className="b-booked-n">{slot.seatsTaken}</span>
        <span className="b-booked-of">of {slot.capacity} places</span>
        {slot.minToRun ? <span className="b-booked-min">Minimum {slot.minToRun}</span> : null}
      </div>
      <div className="b-ticks" aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} className={`b-tick${i < slot.seatsTaken ? " is-on" : ""}${slot.minToRun && i === slot.minToRun - 1 ? " is-min" : ""}`} />
        ))}
      </div>

      {live ? (
        <>
          <div className="m-section">
            <span className="m-kicker m-section-label">Slot settings</span>
            <span className="m-rule" aria-hidden="true" />
          </div>
          <div className="b-block b-sec">
            <Stepper label="Minimum to run" value={min > 0 ? String(min) : "None"} minusOff={min <= 0} plusOff={min >= places} onMinus={() => setMin(Math.max(0, min - 1))} onPlus={() => setMin(Math.min(places, min + 1))} />
            <Stepper label="Places" value={String(places)} minusOff={places <= Math.max(1, slot.seatsTaken, min)} plusOff={places >= 500} onMinus={() => setPlaces(Math.max(Math.max(1, slot.seatsTaken, min), places - 1))} onPlus={() => setPlaces(Math.min(500, places + 1))} />
            <Stepper label="Booking closes" value={minutesLabel(cut)} minusOff={stepCut(cut, -1) === cut} plusOff={stepCut(cut, 1) === cut} onMinus={() => setCut(stepCut(cut, -1))} onPlus={() => setCut(stepCut(cut, 1))} />
            <p className="b-note">Booking closes that long before the start. A different price for one slot is not available yet.</p>
            {saveError ? <p className="b-err" style={{ marginTop: 12 }} role="alert">{saveError}</p> : null}
            {dirty ? (
              <div className="b-save">
                <PrimaryButton disabled={saving} onClick={save}>{saving ? "Saving..." : "Save changes"}</PrimaryButton>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="m-section">
        <span className="m-kicker m-section-label">Guests</span>
        <span className="m-rule" aria-hidden="true" />
        <span className="m-section-more" style={{ color: "var(--faint)" }}>
          {kept.length === 1 ? "1 booking" : `${kept.length} bookings`}
        </span>
      </div>
      <div className="b-block">
        {kept.length === 0 && gone.length === 0 ? <p className="b-empty" style={{ margin: "4px 4px 0" }}>No bookings yet.</p> : null}
        {[...kept, ...gone].map((g) => {
          const status = guestStatus(g.status);
          const label = g.name?.trim() || g.email;
          return (
            <div key={g.bookingId} className={`b-guest${isGone(g.status) ? " is-off" : ""}`}>
              <span className="b-guest-initial" aria-hidden="true">{label.charAt(0).toUpperCase()}</span>
              <span className="b-guest-text">
                <span className="b-guest-name">{label}</span>
                {status || g.note ? <span>{[status, g.note].filter(Boolean).join(" · ")}</span> : null}
              </span>
              <span className="b-guest-party">{g.party}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
