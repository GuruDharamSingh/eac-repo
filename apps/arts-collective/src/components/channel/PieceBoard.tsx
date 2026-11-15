"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useSurface } from "@elkdonis/cms-ui/surface";
import {
  BOARD_LANES,
  fmtDay,
  kindGlyph,
  kindLabel,
  type BoardLane,
  type ItemState,
  type Outlet,
  type Piece,
  type TimelineEntry,
} from "@/lib/channel/model";
import { acceptSuggestionsAction, dismissSuggestionAction } from "@/lib/channel/actions";
import { CHANNEL_BASE, suggestionInput, useChannel } from "./context";
import { OutletIcon } from "./icons";
import { StateMark, Thumb } from "./bits";

const LANE_LABEL: Record<BoardLane, string> = {
  dates: "Dates",
  site: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  video: "Video",
  writing: "Writing",
  live: "Live",
  newsletter: "Newsletter",
};

function laneOf(o: Outlet): BoardLane {
  if (o === "site" || o === "page" || o === "market") return "site";
  if (o === "threads") return "facebook";
  if (o === "youtube") return "video";
  return o as BoardLane;
}

const WEEK = 7 * 86_400_000;

/**
 * The piece board (2b): one piece's outlets against seven weeks, from the
 * week before this one. History, planned drafts and its own dates on one grid
 * with a Today line: confirmed items only (2026-11-12). The suggestions placed in
 * these weeks are counted in the footer, with Plan it and a link to the Queue.
 */
export function PieceBoard({ piece }: { piece: Piece }) {
  const { model, href, scopeOrg } = useChannel();
  const routines = model.routines;
  const surface = useSurface();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hidden, setHidden] = React.useState(false);

  const now = new Date(model.now).getTime();
  const todayMid = new Date(`${model.today}T12:00:00Z`);
  const sunday = new Date(todayMid.getTime() - todayMid.getUTCDay() * 86_400_000);
  const start = sunday.getTime() - WEEK;
  const weeks = Array.from({ length: 7 }, (_, i) => new Date(start + i * WEEK));
  const end = start + 7 * WEEK;
  const col = (at: string) => {
    const t = new Date(at).getTime();
    return Math.max(0, Math.min(6, Math.floor((t - start) / WEEK)));
  };
  const todayPct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));

  type Chip = { id: string; lane: BoardLane; col: number; kind: ItemState | "event"; text: string; earlier: boolean; e?: TimelineEntry };
  const chips: Chip[] = [];
  for (const e of piece.timeline) chips.push({ id: e.id, lane: laneOf(e.outlet), col: col(e.at), kind: e.state, text: `${fmtDay(e.at, model.timeZone)} · ${e.label}`, earlier: new Date(e.at).getTime() < start, e });
  if (piece.eventAt) chips.push({ id: "event", lane: "dates", col: col(piece.eventAt), kind: "event", text: `${piece.title} · ${fmtDay(piece.eventAt, model.timeZone)}`, earlier: false });
  const placed = hidden ? [] : piece.suggestions.filter((s) => s.at && new Date(s.at).getTime() >= start && new Date(s.at).getTime() < end);
  // The board shows confirmed items only (developer, 2026-11-12); the piece's suggestions wait in the
  // Queue, and Plan it below accepts the ones placed in these seven weeks.

  const routinesUsed = new Set(placed.map((s) => s.routineId).filter(Boolean));
  const routineNames = routines.filter((r) => routinesUsed.has(r.id)).map((r) => r.name);

  async function addAll() {
    setBusy(true);
    setError(null);
    const r = await acceptSuggestionsAction(placed.map((s) => suggestionInput(s, scopeOrg)));
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    surface.connectors.onMutated?.();
  }

  async function dismissAll() {
    setBusy(true);
    setError(null);
    let failed = false;
    for (const s of placed) {
      const r = await dismissSuggestionAction(suggestionInput(s, scopeOrg));
      if (r.ok === false) {
        setError(r.error);
        failed = true;
        break;
      }
    }
    setBusy(false);
    // Hide only when every one was dismissed; a refresh shows what is left otherwise.
    if (!failed) setHidden(true);
    surface.connectors.onMutated?.();
  }

  return (
    <div className="chn-page">
      <nav className="chn-crumbs" aria-label="Breadcrumb">
        <Link href={href(CHANNEL_BASE)}>Channel</Link> / <span>{kindLabel(piece.kind)}</span> / <span aria-current="page">{piece.title}</span>
      </nav>
      <header className="chn-head chn-board-head">
        <Thumb piece={piece} size={112} h={84} />
        <div>
          <p className="chn-kicker is-accent">
            Board ·
            {kindGlyph(piece.kind)} {kindLabel(piece.kind)}
          </p>
          <h1>{piece.title}</h1>
          <p>
            {piece.meta}
            {piece.createdAt ? ` · since ${fmtDay(piece.createdAt, model.timeZone)}` : ""}
          </p>
        </div>
        <div className="chn-actions">
          {piece.studioHref && (
            <a className="chn-btn" href={piece.studioHref}>
              Open in Studio
            </a>
          )}
          <Link className="chn-btn is-primary" href={href(`${CHANNEL_BASE}/new`, { about: piece.key })}>
            New post about this
          </Link>
        </div>
      </header>

      <div className="chn-board-wrap">
        <div className="chn-board" style={{ ["--today" as string]: todayPct.toFixed(2) }}>
          <div className="chn-board-row is-head">
            <span />
            {weeks.map((w, i) => (
              <span key={i} className="chn-board-week">
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(w)}
                {i === 1 ? " · this week" : ""}
              </span>
            ))}
          </div>
          {BOARD_LANES.map((lane) => (
            <div key={lane} className="chn-board-row">
              <span className="chn-board-lane">
                {lane === "dates" ? <CalendarDays size={15} aria-hidden /> : <OutletIcon outlet={lane as Outlet} size={15} />} {LANE_LABEL[lane]}
              </span>
              {weeks.map((_, c) => (
                <div key={c} className="chn-board-cell">
                  {chips
                    .filter((x) => x.lane === lane && x.col === c)
                    .map((x) => (
                      <span key={x.id} className="chn-bchip" data-kind={x.kind} title={x.earlier ? "Earlier than this board" : undefined}>
                        {x.kind !== "event" && <StateMark state={x.kind as ItemState} size={11} />} {x.earlier ? "← " : ""}
                        {x.text}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          ))}
          <span className="chn-today" aria-hidden>
            <small>Today</small>
          </span>
        </div>
      </div>

      <footer className="chn-board-foot">
        <p>
          {placed.length === 0
            ? "Nothing suggested for these weeks."
            : `${placed.length} ${placed.length === 1 ? "suggestion waits" : "suggestions wait"} in the Queue for these weeks, placed ${routineNames.length ? `in your ${routineNames.join(", ")} slots` : "by date"}${piece.eventAt ? ` and around ${fmtDay(piece.eventAt, model.timeZone)}` : ""}.`}{" "}
          {piece.suggestions.length > 0 && <Link href={href(`${CHANNEL_BASE}/queue`)}>See them in the Queue</Link>}
          {error && <small className="is-alert"> {error}</small>}
        </p>
        {placed.length > 0 && (
          <div className="chn-actions">
            <button type="button" className="chn-btn" disabled={busy || !model.ready} onClick={dismissAll}>
              Dismiss
            </button>
            <button type="button" className="chn-btn is-primary" disabled={busy || !model.ready} onClick={addAll}>
              Plan it
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
