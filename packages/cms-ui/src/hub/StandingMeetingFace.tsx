"use client";

import * as React from "react";
import {
  SurfaceCard,
  fmtDateTime,
  relativeDay,
  useSurface,
  type SurfaceMaterial,
} from "../surface";
import type {
  HubStandingMeeting,
  StandingMeetingAttendance,
  StandingMeetingHistory,
  StandingMeetingLight,
  StandingMeetingPast,
  RsvpFlavourOption,
} from "./types";
import { faceOf } from "./face-origin";

/**
 * The standing gathering, as a tile.
 *
 * The face carries what a member opens the hub for — cover, when it next
 * happens, how many are coming — and the click opens the full thread popup,
 * RSVP included. Nothing here duplicates that popup; it is the same object at
 * tile size.
 *
 * The kicker tells the truth about WHY this one is showing, because the three
 * cases are not interchangeable. Only a flagged or weekly-recurring gathering
 * may be called the weekly meeting; anything else is just the next thing on,
 * and labelling it "Weekly meeting" would be a small lie the hub repeats
 * every day.
 *
 * ── Three things a host may switch on ───────────────────────────────────────
 *
 * `attendance`, `light` and `history` are each OPT-IN and each default off,
 * because this face is shared: amrit-canada and innergathering render it too,
 * and a card that grew a traffic light and an RSVP menu because another site
 * wanted them would be changing two products without being asked. Pass none
 * of them and this is exactly the card it has always been.
 *
 *   attendance — "Will you make it?", answered in words rather than a
 *                checkbox. Every answer commits to one of the SAME four
 *                statuses `thread_rsvps` already has, so every count in the
 *                network keeps working; the flavour is the part a person
 *                means. See migration 130.
 *   light      — green / yellow / red, on the left of the tools row: is it
 *                happening. A colour cannot be the only carrier of meaning,
 *                so it is always a word too, and the REASON is on the button
 *                for hover, for focus and for a screen reader.
 *   history    — an arrow back to the previous occurrence, and what that one
 *                produced. A material opens as a surface layer; nothing here
 *                navigates away from the hub.
 */

/**
 * Composing from this card starts a WEEKLY gathering.
 *
 * The seed is the point: without it the form opens on "Does not repeat", so a
 * button labelled "Create a weekly meeting" would produce a one-off — which
 * `getStandingMeeting` would then not recognise as weekly, and the card would
 * not pick it up. A suggested default, not a hidden decision: it renders in
 * the Repeats group where it can be changed.
 *
 * `tier: "full"` is required, not decoration. A prefilled compose defaults to
 * the quick tier, and recurrence is not a quick field — so at the default tier
 * the seeded value would be applied without ever being shown.
 */
const WEEKLY_COMPOSE = {
  type: "compose",
  kind: "meeting",
  prefill: { recurrence_pattern: "WEEKLY" },
  tier: "full",
} as const;

const KICKER: Record<HubStandingMeeting["source"], string> = {
  flagged: "Standing gathering",
  weekly: "Weekly meeting",
  next: "Next gathering",
};

/**
 * The same six the service offers, restated here because this package does
 * not import the data layer (see the note at the top of ./types). A host that
 * wants different words passes `attendance.options`.
 */
const DEFAULT_FLAVOURS: RsvpFlavourOption[] = [
  { key: "certain", label: "Yes — 100%", note: "Count on me, every week.", status: "yes" },
  {
    key: "this_week",
    label: "Yes, this week",
    note: "This one for certain. Ask me again after.",
    status: "yes",
  },
  { key: "early", label: "Early yes", note: "It's the intention — it's early days yet.", status: "yes" },
  { key: "hesitant", label: "Hesitant yes", note: "Planning on it, but it could slip.", status: "yes" },
  { key: "temporary", label: "Not this week", note: "A temporary no. Still with you.", status: "no" },
  {
    key: "next_time",
    label: "We'll make it next time",
    note: "Not this run — keep me on the list.",
    status: "no",
  },
];

/** Default hub routes. A host on other paths passes its own `endpoint`. */
const ATTENDANCE_ENDPOINT = "/api/hub/meeting/attendance";
const LIGHT_ENDPOINT = "/api/hub/meeting/light";
const HISTORY_ENDPOINT = "/api/hub/meeting/history";

/** The word beside the dot. Colour is never the only carrier — WCAG 1.4.1. */
const LIGHT_WORD: Record<StandingMeetingLight["state"], string> = {
  green: "Running",
  yellow: "Maybe",
  red: "Off",
};

const LIGHT_CHOICES: Array<{ state: StandingMeetingLight["state"]; label: string; note: string }> = [
  { state: "green", label: "It's happening", note: "Going ahead regardless." },
  { state: "yellow", label: "It might", note: "May or may not run this week." },
  { state: "red", label: "Not this week", note: "Not running this week." },
];

/** A mark per kind of material, so a row is scannable without reading it. */
const MATERIAL_GLYPH: Record<SurfaceMaterial["kind"], string> = {
  image: "▣",
  video: "▶",
  audio: "♪",
  document: "▭",
};

export function StandingMeetingFace({
  standing,
  canEdit,
  timeZone,
  attendance,
  light,
  history,
}: {
  standing: HubStandingMeeting | null;
  canEdit: boolean;
  /**
   * The org's zone. Was hardcoded to America/Toronto when this lived in
   * amrit-canada; a shared face cannot assume that, and a gathering shown in
   * the wrong zone is worse than one shown with no zone at all.
   */
  timeZone?: string;
  /** Opt-in. "Will you make it?", answered in words. Omit and nothing shows. */
  attendance?: StandingMeetingAttendance;
  /** Opt-in. Is it happening: green / yellow / red, with the reason. */
  light?: StandingMeetingLight;
  /** Opt-in. The arrow back to last time, and what it produced. */
  history?: StandingMeetingHistory;
}) {
  const surfaces = useSurface();
  const tz = timeZone ? { timeZone } : {};

  if (!standing) {
    return (
      <SurfaceCard
        kind="meeting"
        kicker="Weekly meeting"
        title="Nothing scheduled"
        blurb={
          canEdit
            ? "Create the gathering and it will lead the hub."
            : "Check back — the next gathering will appear here."
        }
        surface={canEdit ? WEEKLY_COMPOSE : { type: "calendar" }}
        preview={<span className="eac-preview-empty">No date set</span>}
      />
    );
  }

  return (
    <StandingMeeting
      standing={standing}
      canEdit={canEdit}
      tz={tz}
      attendance={attendance}
      light={light}
      history={history}
      surfaces={surfaces}
    />
  );
}

/**
 * The live half, split out so the empty card above stays a plain render with
 * no state at all — and so every hook below runs unconditionally.
 */
function StandingMeeting({
  standing,
  canEdit,
  tz,
  attendance,
  light,
  history,
  surfaces,
}: {
  standing: HubStandingMeeting;
  canEdit: boolean;
  tz: { timeZone?: string };
  attendance?: StandingMeetingAttendance;
  light?: StandingMeetingLight;
  history?: StandingMeetingHistory;
  surfaces: ReturnType<typeof useSurface>;
}) {
  const { event, at, source } = standing;

  // Which menu, if any, is open. One at a time: two popovers in a 30px band
  // would overlap each other.
  const [menu, setMenu] = React.useState<null | "rsvp" | "light">(null);
  const [answer, setAnswer] = React.useState<string | null>(
    attendance?.answered?.flavour ?? null
  );
  // A member who answered before flavours existed still has a status, and the
  // control should say so rather than asking them again.
  const [plainStatus, setPlainStatus] = React.useState<string | null>(
    attendance?.answered?.status ?? null
  );
  const [saving, setSaving] = React.useState(false);
  const [currentLight, setCurrentLight] = React.useState<StandingMeetingLight | null>(
    light ?? null
  );
  // Where the arrow has walked back to. A trail rather than one slot, so the
  // forward arrow can retrace it.
  const [trail, setTrail] = React.useState<StandingMeetingPast[]>([]);
  const [paging, setPaging] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => setCurrentLight(light ?? null), [light]);

  // Escape closes whatever is open, from anywhere — a popover you cannot
  // dismiss without choosing is a trap. So is one that only closes on
  // Escape: the ordinary way to dismiss a menu is to click somewhere else,
  // and a pointerdown listener on the document is what makes that work
  // without swallowing the click that chose an item (pointerdown fires
  // before the click resolves, so the check is "was it inside this menu").
  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(".eac-face-menu-wrap")) return;
      setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [menu]);

  const past = trail.length > 0 ? trail[trail.length - 1] : null;
  const flavours = attendance?.options ?? DEFAULT_FLAVOURS;
  const chosen = flavours.find((f) => f.key === answer) ?? null;

  const relative = relativeDay(at, tz);
  const attendanceLine = event.isRsvpEnabled
    ? `${event.rsvpCount} coming${event.attendeeLimit ? ` of ${event.attendeeLimit}` : ""}`
    : null;

  // ── Answering ────────────────────────────────────────────────────────────

  async function answerWith(option: RsvpFlavourOption | null) {
    if (!attendance) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(attendance.endpoint ?? ATTENDANCE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          option
            ? { threadId: event.id, flavour: option.key }
            : { threadId: event.id, clear: true }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error ?? "That did not save.");
        return;
      }
      setAnswer(option?.key ?? null);
      setPlainStatus(option?.status ?? null);
      // The light may have just turned green: an answer can be the one that
      // meets the minimum. The route says so rather than the card guessing.
      if (data.light) setCurrentLight(data.light as StandingMeetingLight);
      setMenu(null);
      surfaces.connectors.onMutated?.();
    } catch {
      setNote("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  // ── The host's word on the light ─────────────────────────────────────────

  async function setLight(state: StandingMeetingLight["state"] | null, reason?: string) {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(currentLight?.endpoint ?? LIGHT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          state
            ? {
                threadId: event.id,
                state,
                note: reason ?? null,
                occurrence: at.toISOString(),
              }
            : { threadId: event.id, clear: true }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error ?? "That did not save.");
        return;
      }
      if (data.light) {
        setCurrentLight({ ...(currentLight ?? {}), ...(data.light as StandingMeetingLight) });
      }
      setMenu(null);
      surfaces.connectors.onMutated?.();
    } catch {
      setNote("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  // ── Paging back ──────────────────────────────────────────────────────────

  async function pageBack() {
    if (!history) return;
    setPaging(true);
    setNote(null);
    try {
      const anchorId = past ? past.threadId : event.id;
      const anchorAt = past ? past.at : at.toISOString();
      const res = await fetch(
        `${history.endpoint ?? HISTORY_ENDPOINT}?threadId=${encodeURIComponent(
          anchorId
        )}&before=${encodeURIComponent(anchorAt)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error ?? "Could not look back.");
        return;
      }
      if (!data.occurrence) {
        setNote("Nothing before this one.");
        return;
      }
      setTrail((prev) => [...prev, data.occurrence as StandingMeetingPast]);
    } catch {
      setNote("Could not reach the server.");
    } finally {
      setPaging(false);
    }
  }

  function pageForward() {
    setNote(null);
    setTrail((prev) => prev.slice(0, -1));
  }

  // ── The card ─────────────────────────────────────────────────────────────

  const shownAt = past ? new Date(past.at) : at;
  const kicker = past ? (past.sameSeries ? "Last time" : "Before that") : KICKER[source];

  const tools =
    currentLight || attendance || history ? (
      <>
        {currentLight && (
          <LightControl
            light={currentLight}
            canEdit={canEdit}
            open={menu === "light"}
            onToggle={() => setMenu(menu === "light" ? null : "light")}
            onChoose={setLight}
            busy={saving}
          />
        )}

        {attendance && (
          <RsvpControl
            flavours={flavours}
            chosen={chosen}
            plainStatus={plainStatus}
            open={menu === "rsvp"}
            onToggle={() => setMenu(menu === "rsvp" ? null : "rsvp")}
            onChoose={answerWith}
            busy={saving}
          />
        )}

        {history && (
          // A bare "←" in a corner says nothing about where it goes. Back
          // carries the word "Last time"; forward is the one that can be an
          // arrow alone, because it only appears once you are already in the
          // past and its meaning is "undo that".
          <span className="eac-meet-pager">
            {past ? (
              <button
                type="button"
                className="eac-face-tool eac-meet-back"
                onClick={pageForward}
                aria-label="Back to this week"
                title="Back to this week"
              >
                <span aria-hidden>›</span> This week
              </button>
            ) : (
              <button
                type="button"
                className="eac-face-tool eac-meet-back"
                onClick={() => void pageBack()}
                disabled={paging}
                aria-label="See the meeting before this one"
                title="See the meeting before this one"
              >
                <span aria-hidden>‹</span> {paging ? "…" : "Last time"}
              </button>
            )}
          </span>
        )}
      </>
    ) : undefined;

  return (
    <SurfaceCard
      kind={event.kind}
      kicker={kicker}
      title={past ? past.title : event.title}
      blurb={past ? undefined : (event.location ?? undefined)}
      tools={tools}
      surface={
        past
          ? {
              type: "thread",
              id: past.threadId,
              preview: { title: past.title, kind: past.kind, scheduledAt: past.at },
            }
          : {
              type: "thread",
              id: event.id,
              // Seeded so the popup paints its heading before the fetch lands.
              preview: {
                title: event.title,
                kind: event.kind,
                scheduledAt: at.toISOString(),
                coverImageUrl: event.coverImageUrl,
              },
            }
      }
      preview={
        <>
          {!past && event.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="eac-preview-cover"
              src={event.coverImageUrl}
              alt=""
              loading="lazy"
            />
          )}
          <span className="eac-preview-line">
            <span>{fmtDateTime(shownAt, tz)}</span>
          </span>

          {past ? (
            <MaterialsList
              past={past}
              onOpen={(material, origin) =>
                surfaces.open({ type: "material", material, context: past.title }, origin)
              }
            />
          ) : (
            <span className="eac-preview-cue">
              {[relative, attendanceLine].filter(Boolean).join(" · ")}
            </span>
          )}

          {note && (
            <span className="eac-face-live eac-meet-note" role="status">
              {note}
            </span>
          )}

          {/* No weekly gathering exists, so an editor is shown the way to
              make one. `eac-face-live` takes pointer events back from the
              otherwise-inert face — the same opt-in the calendar's day cells
              use — so the rest of the card still opens the thread. The hit
              area is a sibling underneath, not an ancestor, so this needs no
              stopPropagation. */}
          {!past && canEdit && source === "next" && (
            <span className="eac-face-live">
              <button
                type="button"
                className="eac-preview-action"
                onClick={(e) => surfaces.open(WEEKLY_COMPOSE, faceOf(e.currentTarget))}
              >
                Create a weekly meeting
              </button>
            </span>
          )}
        </>
      }
    />
  );
}

// ── The light ───────────────────────────────────────────────────────────────

/**
 * Is it happening.
 *
 * Three carriers, not one: the dot's colour (measured at 3:1 or better on
 * every ground this card sits on, light and dark), the WORD beside it, and
 * the reason — which is on the button as its accessible name, in `title` for
 * a hover, and in a bubble that appears on hover AND on keyboard focus.
 * Hover alone would mean a keyboard user never learns why it is yellow.
 */
function LightControl({
  light,
  canEdit,
  open,
  onToggle,
  onChoose,
  busy,
}: {
  light: StandingMeetingLight;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  onChoose: (state: StandingMeetingLight["state"] | null, reason?: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = React.useState("");
  const word = LIGHT_WORD[light.state];
  const label = `Is it happening: ${word}. ${light.reason}`;
  const settable = canEdit && light.canSet !== false;

  const body = (
    <>
      <span className={`eac-light-dot eac-light-dot--${light.state}`} aria-hidden />
      <span className="eac-light-word">{word}</span>
    </>
  );

  return (
    <span className="eac-light eac-face-menu-wrap">
      {settable ? (
        <button
          type="button"
          className="eac-face-tool eac-light-btn"
          aria-label={`${label} Change it.`}
          title={light.reason}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={onToggle}
        >
          {body}
        </button>
      ) : (
        // Not a button when there is nothing to press: it still takes focus,
        // so the reason is reachable from the keyboard.
        <span className="eac-face-tool eac-light-btn is-static" tabIndex={0} title={light.reason} aria-label={label}>
          {body}
        </span>
      )}

      <span className="eac-light-why" aria-hidden>
        {light.reason}
      </span>

      {settable && open && (
        <div className="eac-face-menu eac-light-menu" role="menu" aria-label="Is it happening">
          {LIGHT_CHOICES.map((choice) => (
            <button
              key={choice.state}
              type="button"
              role="menuitem"
              className="eac-face-menu-item"
              disabled={busy}
              onClick={() => onChoose(choice.state, reason.trim() || choice.note)}
            >
              <span className={`eac-light-dot eac-light-dot--${choice.state}`} aria-hidden />
              <span>
                <span className="eac-face-menu-label">{choice.label}</span>
                <span className="eac-face-menu-note">{choice.note}</span>
              </span>
            </button>
          ))}

          <label className="eac-face-menu-field">
            <span className="eac-face-tool-label">Say why</span>
            <input
              className="eac-face-tool-input"
              value={reason}
              placeholder="Optional — shown on the card"
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
            />
          </label>

          {light.source === "host" && (
            <button
              type="button"
              role="menuitem"
              className="eac-face-menu-item eac-face-menu-item--quiet"
              disabled={busy}
              onClick={() => onChoose(null)}
            >
              <span className="eac-face-menu-label">Let the numbers say</span>
              <span className="eac-face-menu-note">Back to whatever the RSVPs mean.</span>
            </button>
          )}
        </div>
      )}
    </span>
  );
}

// ── Will you make it? ───────────────────────────────────────────────────────

function RsvpControl({
  flavours,
  chosen,
  plainStatus,
  open,
  onToggle,
  onChoose,
  busy,
}: {
  flavours: RsvpFlavourOption[];
  chosen: RsvpFlavourOption | null;
  plainStatus: string | null;
  open: boolean;
  onToggle: () => void;
  onChoose: (option: RsvpFlavourOption | null) => void;
  busy: boolean;
}) {
  // The thumb is the state, not decoration: up once they have said a yes of
  // any shade, down for a no, neither while the question is open.
  const status = chosen?.status ?? plainStatus;
  const thumb = status === "yes" ? "▲" : status === "no" ? "▼" : "◇";
  const label = chosen ? chosen.label : status === "yes" ? "Coming" : status === "no" ? "Not coming" : "Will you make it?";

  return (
    <span className="eac-rsvp eac-face-menu-wrap">
      <button
        type="button"
        className={`eac-face-tool eac-rsvp-btn${status ? ` is-${status}` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
        title="Will you make it?"
      >
        <span className="eac-rsvp-thumb" aria-hidden>
          {thumb}
        </span>
        <span className="eac-rsvp-label">{label}</span>
      </button>

      {open && (
        <div className="eac-face-menu eac-rsvp-menu" role="menu" aria-label="Will you make it?">
          <span className="eac-face-tool-label eac-face-menu-head">Will you make it?</span>
          {flavours.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitem"
              className="eac-face-menu-item"
              disabled={busy}
              aria-current={chosen?.key === option.key || undefined}
              onClick={() => onChoose(option)}
            >
              <span className="eac-rsvp-thumb" aria-hidden>
                {option.status === "yes" ? "▲" : "▼"}
              </span>
              <span>
                <span className="eac-face-menu-label">{option.label}</span>
              </span>
            </button>
          ))}
          {(chosen || plainStatus) && (
            <button
              type="button"
              role="menuitem"
              className="eac-face-menu-item eac-face-menu-item--quiet"
              disabled={busy}
              onClick={() => onChoose(null)}
            >
              <span className="eac-face-menu-label">Take it back</span>
              <span className="eac-face-menu-note">No answer either way.</span>
            </button>
          )}
        </div>
      )}
    </span>
  );
}

// ── What last time produced ─────────────────────────────────────────────────

function MaterialsList({
  past,
  onOpen,
}: {
  past: StandingMeetingPast;
  onOpen: (material: SurfaceMaterial, origin: HTMLElement | null) => void;
}) {
  if (!past.materials || past.materials.length === 0) {
    return <span className="eac-preview-empty">Nothing was kept from this one.</span>;
  }

  return (
    <span className="eac-face-live eac-meet-mats">
      {past.materials.slice(0, 5).map((material) => (
        <button
          key={material.id}
          type="button"
          className="eac-meet-mat"
          onClick={(e) => onOpen(material, faceOf(e.currentTarget))}
          title={material.name}
        >
          <span className="eac-meet-mat-glyph" aria-hidden>
            {MATERIAL_GLYPH[material.kind] ?? "▭"}
          </span>
          <span className="eac-meet-mat-name">{material.name}</span>
        </button>
      ))}
      {past.materials.length > 5 && (
        <span className="eac-preview-cue">+{past.materials.length - 5} more</span>
      )}
    </span>
  );
}
