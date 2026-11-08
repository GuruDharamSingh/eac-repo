"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, PenLine, Radio } from "lucide-react";
import {
  MATRIX_COLUMNS,
  MATRIX_LABELS,
  fmtDay,
  fmtTime,
  type DayItem,
  type Piece,
  type PieceKind,
} from "@/lib/channel/model";
import { CHANNEL_BASE, useChannel } from "./context";
import { OutletIcon } from "./icons";
import { KindLine, NextChip, OutletMarks, RoutinesStrip, StateMark, Thumb, Timeline } from "./bits";
import { NextRow } from "./NextRow";

/** Home (1a): pieces in motion, each with where it went. `?view=matrix` is 1b. */
export function ChannelHome({ view }: { view: "list" | "matrix" }) {
  const { model, href } = useChannel();
  return (
    <div className="chn-page">
      <header className="chn-head">
        <div>
          <h1>Channel</h1>
          <p>
            {view === "matrix"
              ? "Where each piece has been published, and where it hasn't yet."
              : "Each piece of work and the posts that followed it, across the site, Instagram and Facebook."}
          </p>
        </div>
        <div className="chn-actions">
          <div className="chn-seg" role="group" aria-label="View">
            <Link href={href(CHANNEL_BASE)} aria-current={view === "list" ? "page" : undefined}>
              In motion
            </Link>
            <Link href={href(CHANNEL_BASE, { view: "matrix" })} aria-current={view === "matrix" ? "page" : undefined}>
              Matrix
            </Link>
          </div>
          {/* The broadcast booth is admin-only; for anyone else the button would open onto a refusal. */}
          {model.viewer.isAdmin && (
            <a className="chn-btn" href={model.links.live}>
              <Radio size={15} aria-hidden className="is-live" /> Go live
            </a>
          )}
          <Link className="chn-btn is-primary" href={href(`${CHANNEL_BASE}/new`)}>
            <PenLine size={15} aria-hidden /> New post
          </Link>
        </div>
      </header>
      {view === "matrix" ? <Matrix /> : <InMotion />}
    </div>
  );
}

function InMotion() {
  const { model } = useChannel();
  // Ahead first (soonest first), then the recently published (newest first), then plan-only.
  const nowIso = model.now;
  const rank = (p: (typeof model.pieces)[number]) => {
    const at = p.inMotion?.at;
    if (!at) return [2, ""] as const;
    return at >= nowIso ? ([0, at] as const) : ([1, String(9e15 - Date.parse(at))] as const);
  };
  const moving = model.pieces
    .filter((p) => p.inMotion)
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra[0] - rb[0] || ra[1].localeCompare(rb[1]);
    });
  const list = moving.length ? moving : model.pieces.slice(0, 8);
  const [selected, setSelected] = React.useState<string | null>(list[0]?.key ?? null);
  const piece = list.find((p) => p.key === selected) ?? list[0];

  return (
    <>
      {/* Next moves (dock/LMS-driven, in place of 1a's count bands): lib/channel/next.ts. */}
      <NextRow />
      <RoutinesStrip routines={model.routines} />
      {model.pieces.length === 0 ? (
        <div className="chn-empty">
          <h2>Nothing here yet</h2>
          <p>Pieces appear once you have written something, listed a work on the market, or scheduled a meeting.</p>
          <div className="chn-actions">
            <a className="chn-btn" href={model.links.writing}>
              Write in the Studio
            </a>
            <a className="chn-btn" href={model.links.artwork}>
              Add a work to the market
            </a>
          </div>
        </div>
      ) : (
        <div className="chn-home">
          <section aria-labelledby="chn-motion-h">
            <h2 id="chn-motion-h" className="chn-kicker">
              {moving.length ? `In motion · ${moving.length}` : `Recent · ${list.length}`}
            </h2>
            {!moving.length && <p className="chn-quiet">Nothing is in motion: nothing scheduled, dated or published in the last 14 days.</p>}
            <ul className="chn-motion" aria-label="Pieces">
              {list.map((p) => (
                <li key={p.key}>
                  <button type="button" aria-pressed={p.key === piece?.key} className="chn-motion-row" onClick={() => setSelected(p.key)}>
                    <Thumb piece={p} />
                    <span className="chn-motion-text">
                      <strong>{p.title}</strong>
                      <span className="chn-motion-line">
                        <KindLine piece={p} />
                        <OutletMarks piece={p} />
                      </span>
                      <small>{p.inMotion?.reason ?? p.meta}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {piece && <PieceFace piece={piece} />}
        </div>
      )}
    </>
  );
}

/** The piece face (1a, right): click it and it grows into the piece pop-up (3a). */
function PieceFace({ piece }: { piece: Piece }) {
  const { openPiece, href } = useChannel();
  const ref = React.useRef<HTMLElement>(null);
  const open = () => openPiece(piece.key, ref.current);
  return (
    <article
      ref={ref}
      className="chn-face"
      tabIndex={0}
      aria-label={`${piece.title}: open`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        open();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="chn-face-top">
        <Thumb piece={piece} size={200} h={150} />
        <div>
          <p className="chn-kicker is-accent">
            <KindLine piece={piece} />
          </p>
          <h2>{piece.title}</h2>
          <p className="chn-quiet">{piece.meta}</p>
          <div className="chn-face-links">
            {piece.studioHref && <a href={piece.studioHref}>Open in Studio</a>}
            {piece.href && (
              <a href={piece.href} target="_blank" rel="noreferrer">
                View on the site <ExternalLink size={11} aria-hidden />
              </a>
            )}
            <Link href={href(`${CHANNEL_BASE}/new`, { about: piece.key })}>New post about this</Link>
          </div>
        </div>
      </div>
      <h3 className="chn-kicker">Where it has gone</h3>
      <Timeline entries={piece.timeline} limit={6} />
      {piece.suggestions.length > 0 && (
        <>
          <h3 className="chn-kicker">Next for this piece</h3>
          <div className="chn-chips">
            {piece.suggestions.slice(0, 3).map((s) => (
              <NextChip key={s.id} suggestion={s} piece={piece} />
            ))}
          </div>
        </>
      )}
      <p className="chn-face-hint">
        <button type="button" className="chn-linkbtn" onClick={open}>
          Open this piece
        </button>
      </p>
    </article>
  );
}

const FILTERS: Array<{ id: "all" | PieceKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "artwork", label: "Artwork" },
  { id: "writing", label: "Writing" },
  { id: "video", label: "Video" },
  { id: "series", label: "Series" },
  { id: "meeting", label: "Meeting" },
];

/** Coverage matrix (1b): pieces against outlets; gaps become suggestions. */
function Matrix() {
  const { model, openPiece } = useChannel();
  const [filter, setFilter] = React.useState<"all" | PieceKind>("all");
  const match = (p: Piece) =>
    filter === "all" || p.kind === filter || (filter === "artwork" && p.kind === "product") || (filter === "series" && p.kind === "workshop") || (filter === "meeting" && p.kind === "event");
  const rows = model.pieces.filter(match).slice(0, 60);
  const coming = model.week.days;

  return (
    <>
      <div className="chn-matrix-bar">
        <div className="chn-seg" role="group" aria-label="Kind">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <ul className="chn-legend" aria-label="Legend">
          <li>
            <StateMark state="published" /> Published
          </li>
          <li>
            <StateMark state="scheduled" /> Scheduled
          </li>
          <li>
            <StateMark state="draft" /> Draft
          </li>
          <li>
            <span className="chn-gap is-sample">+ Suggestion</span>
          </li>
        </ul>
      </div>
      <div className="chn-matrix-wrap">
        <table className="chn-matrix">
          <thead>
            <tr>
              <th scope="col">Piece</th>
              {MATRIX_COLUMNS.map((c) => (
                <th key={c} scope="col">
                  <OutletIcon outlet={c} size={15} />
                  <span>{MATRIX_LABELS[c]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.key}>
                <th scope="row">
                  <button type="button" className="chn-matrix-piece" onClick={(e) => openPiece(p.key, e.currentTarget)}>
                    <Thumb piece={p} size={40} />
                    <span>
                      <strong>{p.title}</strong>
                      <KindLine piece={p} />
                    </span>
                  </button>
                </th>
                {MATRIX_COLUMNS.map((c) => {
                  const cell = p.row[c];
                  return (
                    <td key={c}>
                      {cell.state !== "empty" ? (
                        <span className="chn-cell" data-state={cell.state}>
                          <StateMark state={cell.state} /> {cell.state === "draft" ? "Draft" : fmtDay(cell.at, model.timeZone)}
                        </span>
                      ) : cell.suggestion ? (
                        <NextChip suggestion={cell.suggestion} piece={p} compact />
                      ) : (
                        <span className="chn-none" aria-label="Not yet">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="chn-coming" aria-labelledby="chn-coming-h">
        <h2 id="chn-coming-h" className="chn-kicker">
          Coming up · {model.week.label}
        </h2>
        <ol className="chn-coming-days">
          {coming.map((d) => (
            <li key={d.date}>
              <span className="chn-day-label">{d.label}</span>
              {d.items.filter((i) => i.type === "event" || i.type === "post").map((i) => (
                <ComingItem key={i.id} item={i} />
              ))}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function ComingItem({ item }: { item: DayItem }) {
  const { model, openPiece } = useChannel();
  if (item.type === "event")
    return (
      <button type="button" className="chn-coming-item is-event" onClick={() => openPiece(item.pieceKey)}>
        {item.title}
      </button>
    );
  if (item.type !== "post") return null;
  return (
    <button type="button" className="chn-coming-item" data-state={item.state} onClick={() => item.pieceKey && openPiece(item.pieceKey)}>
      <OutletIcon outlet={item.outlets[0]!} state={item.state} size={13} /> {item.title} · {fmtTime(item.at, model.timeZone)}
    </button>
  );
}

