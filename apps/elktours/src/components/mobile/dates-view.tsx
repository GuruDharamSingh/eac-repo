"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import "@/blocks/mobile/flow.css";
import { BackButton, PrimaryButton, SectionHeader } from "@/components/mobile";
import type { TourSlotView } from "@/lib/tour-slots";
import { formatDeparture, formatWallDate, wallDay } from "@/lib/tour-format";

// Screen 04, Date & time (G3b). A code screen: fixed copy, rules from the slot (its own ruleText). Slot states:
// open = pickable ("N of M places left"); full / full_waitlist = "Full" (no waitlist in v1, so no join); closed =
// "Booking closed"; cancelled and past slots are not listed.

const TZ = "Europe/Paris";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
// Written from numeric parts (lib/tour-format.ts) so server and browser print the same text (React #418 otherwise).
const closing = (iso: string) => formatDeparture(iso);
const dayLabel = (key: string) => formatWallDate(wallDay(key), { long: true });
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

export function DatesView({ slug, title, slots: all, initialSlot }: { slug: string; title: string; slots: TourSlotView[]; initialSlot: string | null }) {
  const slots = useMemo(() => all.filter((s) => s.state !== "cancelled" && s.stateKey !== "past"), [all]);
  const byDay = useMemo(() => {
    const m = new Map<string, TourSlotView[]>();
    for (const s of slots) { const k = dayKey(s.startsAt); m.set(k, [...(m.get(k) ?? []), s]); }
    return m;
  }, [slots]);
  const days = [...byDay.keys()].sort();
  const start = slots.find((s) => s.slotId === initialSlot) ?? slots.find((s) => s.state === "open") ?? slots[0] ?? null;
  const [pickedId, setPickedId] = useState<string | null>(start && start.state === "open" ? start.slotId : null);
  const [day, setDay] = useState<string | null>(start ? dayKey(start.startsAt) : null);
  const [month, setMonth] = useState<string>((day ?? days[0] ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
  const [party, setParty] = useState(1);

  const picked = slots.find((s) => s.slotId === pickedId) ?? null;
  const maxParty = picked ? Math.max(1, Math.min(6, picked.seatsLeft, picked.maxParty)) : 6;
  const n = Math.min(party, maxParty);
  const total = picked && picked.priceMinor != null ? money(picked.priceMinor * n, picked.currency) : null;
  // A slot on a tour with no price cannot be paid for (quoteBooking refuses it); say so rather than leave Continue dead.
  const unpriced = picked != null && picked.priceMinor == null;

  if (slots.length === 0) {
    return (
      <div className="elk-m m-flow">
        <Top slug={slug} title={title} />
        <p className="m-flow-empty">
          <strong>No dates yet.</strong> Private days are arranged directly with the guide. <Link href={`/tours/${slug}`}>Back to the tour</Link>
        </p>
      </div>
    );
  }

  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const keyOf = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(first);
  const monthsWithSlots = [...new Set(days.map((d) => d.slice(0, 7)))].sort();
  const mi = monthsWithSlots.indexOf(month);
  const shown = day ? byDay.get(day) ?? [] : [];

  return (
    <div className="elk-m m-flow">
      <Top slug={slug} title={title} />
      <div className="m-flow-card">
        <div className="m-cal-head">
          <div>
            <span className="m-cal-month">{monthName}</span> <span className="m-cal-year">{y}</span>
          </div>
          <div className="m-cal-nav">
            <button type="button" aria-label="Earlier month" disabled={mi <= 0} onClick={() => setMonth(monthsWithSlots[mi - 1]!)}>‹</button>
            <button type="button" aria-label="Later month" disabled={mi < 0 || mi >= monthsWithSlots.length - 1} onClick={() => setMonth(monthsWithSlots[mi + 1]!)}>›</button>
          </div>
        </div>
        <div className="m-cal-grid">
          {WEEK.map((w, i) => <span key={i} className="m-cal-wd">{w}</span>)}
          {cells.map((d, i) => {
            if (d == null) return <span key={i} />;
            const k = keyOf(d);
            const has = byDay.has(k);
            return (
              <div key={i} className="m-cal-cell">
                <button
                  type="button"
                  disabled={!has}
                  className={`m-cal-day${has ? " has-slot" : ""}${k === day ? " is-picked" : ""}`}
                  onClick={() => {
                    setDay(k);
                    const open = (byDay.get(k) ?? []).find((s) => s.state === "open");
                    setPickedId(open ? open.slotId : null);
                  }}
                >
                  {d}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {day && <SectionHeader label={dayLabel(day)} />}
      <div className="m-slots">
        {shown.map((s) => {
          const open = s.state === "open";
          const l1 = open ? `${s.seatsLeft} of ${s.capacity} places left` : s.state === "closed" ? "Booking closed" : "Full";
          return (
            <button
              key={s.slotId}
              type="button"
              disabled={!open}
              aria-pressed={s.slotId === pickedId}
              className={`m-slot${s.slotId === pickedId ? " is-picked" : ""}${open ? "" : " is-off"}`}
              onClick={() => { setPickedId(s.slotId); setParty((p) => Math.min(p, Math.max(1, Math.min(6, s.seatsLeft, s.maxParty)))); }}
            >
              <span className="m-slot-time">
                <span className="m-slot-start">{clock(s.startsAt)}</span>
                <span className="m-slot-end">to {clock(s.endsAt)}</span>
              </span>
              <span className="m-slot-text">
                <span className={`m-slot-l1${open ? (s.seatsLeft <= 3 ? " is-short" : " is-ok") : ""}`}>{l1}</span>
                <span className="m-slot-l2">
                  {[s.state === "closed" ? null : `Booking closes ${closing(s.closesAt)}`, s.guide ? `with ${s.guide.name}` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="m-slot-dot" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {picked && (
        <>
          <div className="m-party">
            <span>
              <span className="m-party-label">People</span>
              <span className="m-party-hint">{maxParty === 1 ? "One place left" : `Up to ${maxParty}`}</span>
            </span>
            <span className="m-party-ctl">
              <button type="button" aria-label="Fewer people" disabled={n <= 1} onClick={() => setParty(n - 1)}>−</button>
              <span className="m-party-n">{n}</span>
              <button type="button" aria-label="More people" disabled={n >= maxParty} onClick={() => setParty(n + 1)}>+</button>
            </span>
          </div>
          {picked.ruleText && <p className="m-flow-note">{picked.ruleText}</p>}
        </>
      )}
      {unpriced && <p className="m-flow-note">This tour has no price yet, so it cannot be booked online. Ask us about this date and we will arrange it.</p>}

      <div className="m-flow-bar">
        <div className="m-flow-total">
          <span className="m-flow-total-amount">{total ?? "—"}</span>
          <span className="m-flow-total-sub">{picked ? `${n} ${n === 1 ? "person" : "people"}` : "Pick a date"}</span>
        </div>
        {unpriced ? (
          <PrimaryButton href="/about">Ask us about it</PrimaryButton>
        ) : (
          <PrimaryButton disabled={!picked || total == null} href={picked ? `/tours/${slug}/book?slot=${picked.slotId}&party=${n}` : undefined}>
            Continue
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function Top({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="m-flow-top">
      <BackButton href={`/tours/${slug}`} />
      <div className="m-flow-top-text">
        <span className="m-kicker">Choose a date</span>
        <span className="m-flow-top-title">{title}</span>
      </div>
    </div>
  );
}
