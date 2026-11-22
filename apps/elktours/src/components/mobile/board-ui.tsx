import Link from "next/link";
import type { BoardSlot } from "@/lib/tour-slots";
import { formatWallDate, wallDay } from "@/lib/tour-format";

// Shared bits of the board screens (G7a): formatting in Paris time, the seat bar and the slot card.

const TZ = "Europe/Paris";

export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
export const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
// From numeric parts (lib/tour-format.ts): Intl's weekday patterns differ between Node and the browser (React #418).
export const dayLong = (key: string) => formatWallDate(wallDay(key), { long: true });
export const dayShort = (key: string) => formatWallDate(wallDay(key));
export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

/** Minutes as words: "6 hours", "1 day", "2 days", "5 h 20 min". */
export function minutesLabel(m: number): string {
  if (m <= 0) return "At the start";
  if (m % 1440 === 0) return m === 1440 ? "1 day" : `${m / 1440} days`;
  if (m % 60 === 0) return m === 60 ? "1 hour" : `${m / 60} hours`;
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** The cutoff presets: 6h, 12h, 1 day, 2 days, 3 days. */
export const CUTOFFS = [360, 720, 1440, 2880, 4320];

/** Tone colours (booking-core SlotTone). */
export function toneColor(tone: BoardSlot["tone"]): string {
  switch (tone) {
    case "ok":
    case "confirmed":
      return "hsl(var(--verdigris))";
    case "short":
      return "hsl(var(--brass-light))";
    case "attention":
      return "hsl(var(--terracotta))";
    default:
      return "var(--faint)";
  }
}

export function SeatBar({ slot }: { slot: Pick<BoardSlot, "seatsTaken" | "capacity" | "minToRun"> }) {
  const pct = slot.capacity > 0 ? Math.min(100, (slot.seatsTaken / slot.capacity) * 100) : 0;
  const min = slot.minToRun && slot.capacity > 0 ? Math.min(100, (slot.minToRun / slot.capacity) * 100) : null;
  return (
    <div className="b-bar-row">
      <div className="b-bar" aria-hidden="true">
        <div className="b-bar-fill" style={{ width: `${pct}%` }} />
        {min != null ? <div className="b-bar-min" style={{ left: `${min}%` }} /> : null}
      </div>
      <span className="b-bar-seats">{slot.seatsTaken}/{slot.capacity}</span>
    </div>
  );
}

/** One slot as a card (Schedule, Board home, Decisions). Opens the slot page. */
export function SlotCard({ slot, showGuide, showDay }: { slot: BoardSlot; showGuide?: boolean; showDay?: boolean }) {
  const cancelled = slot.status === "cancelled";
  const off = cancelled || slot.stateKey === "past";
  const extra = slot.status === "scheduled" && slot.stateKey === "open" ? slot.note : null;
  return (
    <Link href={`/manage/schedule/${slot.slotId}`} className={`b-card${off ? " is-off" : ""}`} style={{ ["--tone" as string]: toneColor(slot.tone) }}>
      <div className="b-card-row">
        <div className="b-card-time">
          <span className="b-card-start">{clock(slot.startsAt)}</span>
          <span className="b-card-end">{showDay ? dayShort(dayKey(slot.startsAt)) : `to ${clock(slot.endsAt)}`}</span>
        </div>
        <div className="b-card-text">
          <span className={`b-card-title${cancelled ? " is-struck" : ""}`}>{slot.tourTitle}</span>
          <span className="b-card-status">{slot.label}</span>
        </div>
        {showGuide && slot.guide ? <span className="b-card-guide" title={slot.guide.name}>{slot.guide.name.charAt(0).toUpperCase()}</span> : null}
      </div>
      {!cancelled ? <SeatBar slot={slot} /> : null}
      {extra ? <span className="b-card-extra">{extra}</span> : null}
    </Link>
  );
}

/** Header row: avatar initial, name, role line. */
export function BoardWho({ name, sub }: { name: string; sub: string }) {
  return (
    <div className="b-top">
      <div className="b-who" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
      <div className="b-top-text">
        <span className="b-top-name">{name}</span>
        <span className="b-top-sub">{sub}</span>
      </div>
      {/* The way back to the public pages (Discover) from the office screens; same look as a section's "more" link. */}
      <Link href="/" className="m-section-more" data-part="public-site">View site →</Link>
    </div>
  );
}

/** Vermilion banner: slots that closed below their minimum wait for the guide. */
export function DecideBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link href="/manage/decisions" className="b-banner">
      <span className="b-banner-dot" aria-hidden="true" />
      <span className="b-banner-text">
        <strong>{count === 1 ? "1 slot needs your call" : `${count} slots need your call`}</strong>
        <span>Booking closed below the minimum.</span>
      </span>
      <span className="b-banner-go">Decide →</span>
    </Link>
  );
}
