"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

// ============================================================================
// The next weekly meeting, as the page's banner (user's spec, revised
// 2026-09-18, 2026-09-20).
//
// One photo at a time, filling its side of the card edge to edge; with more
// than one they cross-fade slowly (not under prefers-reduced-motion). The
// card carries what a member comes for: the date (top right), the title and
// host, a Join video link, "Is it happening" (widened past org editors to
// whoever the rota has down as this occurrence's host or co-host), "Will you
// make it?" as a menu of answers in words — one line each, no second line of
// explanatory text — and, for a repeating gathering, a way into the rota
// itself. Anywhere else on the card opens the meeting's popup.
//
// Phone: the photo runs across the top, then the date and the title side by
// side on one line, then the host and the actions.
// Text never sits on the photo.
// ============================================================================

export interface MeetingAttendanceOption {
  key: string;
  label: string;
  status: string;
}

export interface MeetingLightData {
  state: "green" | "yellow" | "red";
  reason: string;
  source?: "host" | "derived" | "default";
  /** Server-computed: an owner/guide, or this occurrence's host/co-host. */
  canSet: boolean;
  endpoint: string;
}

const LIGHT_WORD: Record<MeetingLightData["state"], string> = {
  green: "Running",
  yellow: "Maybe",
  red: "Off",
};
const LIGHT_CHOICES: Array<{ state: MeetingLightData["state"]; label: string }> = [
  { state: "green", label: "It's happening" },
  { state: "yellow", label: "It might" },
  { state: "red", label: "Not this week" },
];

export interface MeetingBannerData {
  id: string;
  title: string;
  /** ISO instant of THIS occurrence. */
  at: string;
  location?: string | null;
  /** "Next weekly meeting" only when it really is one. */
  kicker: string;
  photos: string[];
  host?: { name: string; avatarUrl: string | null } | null;
  /** The video room, when there is one (meeting URL or the Talk room). */
  joinUrl?: string | null;
  /** Answers in words. Omit to hide the menu (RSVPs closed). */
  attendance?: {
    endpoint: string;
    options: MeetingAttendanceOption[];
    answered: string | null;
    /** Only ever true alongside `answered === "next_time"`. Migration 155. */
    promiseNext?: boolean;
  } | null;
  /** Is it happening. Omit to hide the control entirely. */
  light?: MeetingLightData | null;
  /** Opens the shared rota surface. Omit for a one-off, non-repeating gathering. */
  planAheadThreadId?: string | null;
}

export function MeetingBanner({ meeting, timeZone }: { meeting: MeetingBannerData | null; timeZone: string }) {
  if (!meeting) return null;
  return <Banner meeting={meeting} timeZone={timeZone} />;
}

function Banner({ meeting, timeZone }: { meeting: MeetingBannerData; timeZone: string }) {
  const surfaces = useSurfaceOptional();
  const cardRef = React.useRef<HTMLElement>(null);
  const [photo, setPhoto] = React.useState(0);
  const [answer, setAnswer] = React.useState(meeting.attendance?.answered ?? null);
  const [promise, setPromise] = React.useState(Boolean(meeting.attendance?.promiseNext));
  const [light, setLight] = React.useState(meeting.light ?? null);
  const [openMenu, setOpenMenu] = React.useState<null | "rsvp" | "light">(null);
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const photos = meeting.photos;
  // A slow cross-fade between photos; none when the person asked for less motion.
  React.useEffect(() => {
    if (photos.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setPhoto((p) => (p + 1) % photos.length), 7000);
    return () => window.clearInterval(t);
  }, [photos.length]);

  // Close whichever menu is open on Escape or a click elsewhere.
  React.useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(".eac-hs-rsvp, .eac-hs-light")) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [openMenu]);

  const at = new Date(meeting.at);
  const part = (o: Intl.DateTimeFormatOptions) => at.toLocaleString(undefined, { timeZone, ...o });

  const open = () =>
    surfaces?.open(
      { type: "thread", id: meeting.id, preview: { title: meeting.title, kind: "meeting" } },
      cardRef.current
    );

  const chosen = meeting.attendance?.options.find((o) => o.key === answer) ?? null;

  async function choose(key: string, promiseValue: boolean) {
    if (!meeting.attendance) return;
    setBusy(true);
    setErrorMsg(null);
    // Only "no, next time" carries a promise; anything else drops it.
    const nextPromise = key === "next_time" && promiseValue;
    try {
      const res = await fetch(meeting.attendance.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: meeting.id, flavour: key, promiseNext: nextPromise }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error ?? "That did not save.");
        return;
      }
      setAnswer(key);
      setPromise(nextPromise);
      setOpenMenu(null);
      if (data.light) setLight(data.light as MeetingLightData);
      surfaces?.connectors.onMutated?.();
    } catch {
      setErrorMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function setState(state: MeetingLightData["state"]) {
    if (!light) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(light.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: meeting.id, state, occurrence: meeting.at }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error ?? "That did not save.");
        return;
      }
      if (data.light) setLight({ ...light, ...(data.light as Partial<MeetingLightData>) });
      setOpenMenu(null);
      surfaces?.connectors.onMutated?.();
    } catch {
      setErrorMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      ref={cardRef}
      aria-label={meeting.kicker}
      className={`eac-hs-banner${photos.length ? "" : " is-bare"}`}
      // The card opens the meeting; its own controls do their own thing.
      onClick={(e) => {
        if ((e.target as Element).closest("a, button, [role=menu]")) return;
        open();
      }}
    >
      {photos.length > 0 && (
        <div className="eac-hs-banner-photo" aria-hidden>
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className={i === photo ? "is-on" : undefined} loading={i === 0 ? "eager" : "lazy"} />
          ))}
        </div>
      )}

      <div className="eac-hs-banner-body">
        <div className="eac-hs-banner-headline">
          <span className="eac-hs-banner-date" aria-label={part({ weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}>
            <span className="eac-hs-banner-dow">{part({ weekday: "short" })}</span>
            <span className="eac-hs-banner-day">{part({ day: "numeric" })}</span>
            <span className="eac-hs-banner-mon">{part({ month: "short" })}</span>
          </span>
          <span className="eac-hs-banner-titles">
            <span className="eac-hs-kicker">
              {meeting.kicker} · {part({ hour: "numeric", minute: "2-digit" })}
            </span>
            <button type="button" className="eac-hs-banner-title" aria-haspopup="dialog" onClick={open}>
              {meeting.title}
            </button>
          </span>
        </div>

        <div className="eac-hs-banner-host">
          <span className="eac-hs-avatar">
            {meeting.host?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meeting.host.avatarUrl} alt="" />
            ) : (
              <span aria-hidden>{(meeting.host?.name ?? "?").slice(0, 1)}</span>
            )}
          </span>
          <span className="eac-hs-muted">
            {meeting.host?.name ? `Hosted by ${meeting.host.name}` : "Host not set yet"}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </span>
          {meeting.planAheadThreadId && (
            <button
              type="button"
              className="eac-hs-link eac-hs-banner-plan"
              onClick={(e) =>
                surfaces?.open(
                  {
                    type: "custom",
                    key: "meeting-rota",
                    title: "Plan ahead",
                    kind: "meeting",
                    size: "wide",
                    props: { threadId: meeting.planAheadThreadId },
                  },
                  e.currentTarget
                )
              }
            >
              Plan ahead
            </button>
          )}
        </div>

        <div className="eac-hs-banner-actions">
          {meeting.joinUrl && (
            <a className="eac-btn eac-btn--primary" href={meeting.joinUrl} target="_blank" rel="noopener">
              ▶ Join video
            </a>
          )}

          {light && (
            <span className="eac-hs-light">
              {light.canSet ? (
                <button
                  type="button"
                  className={`eac-btn is-light-${light.state}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "light"}
                  disabled={busy}
                  title={light.reason}
                  onClick={() => setOpenMenu((m) => (m === "light" ? null : "light"))}
                >
                  <span className={`eac-hs-light-dot eac-hs-light-dot--${light.state}`} aria-hidden />
                  {LIGHT_WORD[light.state]} ▾
                </button>
              ) : (
                <span className="eac-hs-light-static" title={light.reason}>
                  <span className={`eac-hs-light-dot eac-hs-light-dot--${light.state}`} aria-hidden />
                  {LIGHT_WORD[light.state]}
                </span>
              )}
              {light.canSet && openMenu === "light" && (
                <span className="eac-hs-rsvp-menu" role="menu" aria-label="Is it happening">
                  {LIGHT_CHOICES.map((c) => (
                    <button key={c.state} type="button" role="menuitemradio" aria-checked={light.state === c.state} onClick={() => void setState(c.state)}>
                      <span className={`eac-hs-light-dot eac-hs-light-dot--${c.state}`} aria-hidden />
                      <span className="eac-hs-rsvp-label">{c.label}</span>
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}

          {meeting.attendance && meeting.attendance.options.length > 0 && (
            <span className="eac-hs-rsvp">
              <button
                type="button"
                className={`eac-btn${chosen ? ` is-${chosen.status}` : ""}`}
                aria-haspopup="menu"
                aria-expanded={openMenu === "rsvp"}
                disabled={busy}
                onClick={() => setOpenMenu((m) => (m === "rsvp" ? null : "rsvp"))}
              >
                {chosen ? chosen.label : "Will you make it?"} ▾
              </button>
              {openMenu === "rsvp" && (
                <span className="eac-hs-rsvp-menu" role="menu" aria-label="Will you make it?">
                  {meeting.attendance.options.map((o) => (
                    <span key={o.key} className="eac-hs-rsvp-menu-row">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={o.key === answer}
                        onClick={() => void choose(o.key, o.key === "next_time" && promise)}
                      >
                        <span className="eac-hs-rsvp-label">
                          {o.key === answer ? "✓ " : ""}
                          {o.label}
                        </span>
                      </button>
                      {/* A soft commitment to the occurrence AFTER this one —
                          the one place a promise means anything. Migration 155. */}
                      {o.key === "next_time" && (
                        <label className="eac-rsvp-promise" onClick={(e) => e.stopPropagation()} title="Promise to make the one after this?">
                          <span className="eac-rsvp-promise-cap">Promise?</span>
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={answer === "next_time" && promise}
                            onChange={(e) => void choose("next_time", e.target.checked)}
                          />
                        </label>
                      )}
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
          {errorMsg && <span className="eac-hs-status is-error">{errorMsg}</span>}
        </div>
      </div>
    </section>
  );
}
