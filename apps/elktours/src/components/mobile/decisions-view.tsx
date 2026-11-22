"use client";

import Link from "next/link";
import { useState } from "react";
import "@/blocks/mobile/flow.css";
import "./board.css";
import { BackButton } from "@/components/mobile";
import { getSlot } from "@/lib/slot-actions";
import type { BoardSlot } from "@/lib/tour-slots";
import { SeatBar, clock, dayKey, dayShort, toneColor } from "./board-ui";
import { SlotActions } from "./slot-actions-ui";

function Decision({ initial }: { initial: BoardSlot }) {
  const [slot, setSlot] = useState(initial);
  async function refresh() {
    const r = await getSlot(slot.slotId);
    if (r.ok) setSlot(r.slot);
  }
  const cancelled = slot.status === "cancelled";
  return (
    <div className={`b-card${cancelled ? " is-off" : ""}`} style={{ ["--tone" as string]: toneColor(slot.tone) }}>
      <Link href={`/manage/schedule/${slot.slotId}`} className="b-card-row" style={{ color: "inherit", textDecoration: "none" }}>
        <div className="b-card-time">
          <span className="b-card-start">{dayShort(dayKey(slot.startsAt))}</span>
          <span className="b-card-end">{clock(slot.startsAt)}</span>
        </div>
        <div className="b-card-text">
          <span className={`b-card-title${cancelled ? " is-struck" : ""}`}>{slot.tourTitle}</span>
          <span className="b-card-status">{slot.label}</span>
        </div>
      </Link>
      <SeatBar slot={slot} />
      <div style={{ margin: "0 -16px" }}>
        <SlotActions slot={slot} onChanged={refresh} />
      </div>
    </div>
  );
}

/** Screen 34, Decisions: slots that closed below their minimum. (The "full with a waitlist" list is off with the waitlist.) */
export function DecisionsView({ name, below, rule }: { name: string; below: BoardSlot[]; rule: "guide_decides" | "auto_cancel" }) {
  return (
    <div className="b-page" style={{ paddingBottom: 48 }}>
      <div className="b-top">
        <BackButton href="/manage" />
      </div>
      <div className="b-head">
        <span className="m-kicker" style={{ color: "hsl(var(--muted-foreground))" }}>{name}</span>
        <h1 className="b-title">Decisions</h1>
      </div>
      <p className="b-intro">
        {rule === "auto_cancel"
          ? "Your rule: slots below their minimum are cancelled automatically at cutoff, and guests are told. Anything still listed here has not been swept yet: run it or reopen booking to keep it."
          : "Your rule: you decide. These slots closed below their minimum. Run one, give it more time, or cancel it."}
      </p>

      {below.length > 0 ? (
        <>
          <div className="m-section">
            <span className="m-kicker m-section-label">Below minimum at cutoff</span>
            <span className="m-rule" aria-hidden="true" />
            <span className="m-section-more" style={{ color: "var(--faint)" }}>{below.length}</span>
          </div>
          <div className="b-list" style={{ paddingTop: 0 }}>
            <div className="b-cards">
              {below.map((s) => (
                <Decision key={s.slotId} initial={s} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="b-empty">{rule === "auto_cancel" ? "Nothing to decide. Slots that close below their minimum are cancelled for you." : "Nothing waiting on you."}</p>
      )}
    </div>
  );
}
