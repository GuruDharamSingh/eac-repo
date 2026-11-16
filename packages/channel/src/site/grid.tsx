"use client";

import { mediaThumbnail } from "@elkdonis/utils/media-thumbnail";
import * as React from "react";
import Link from "next/link";
import { fmtDay, fmtTime, fromZonedInput, toZonedInput } from "../model";
import { outletLabel } from "../labels";
import { NoteLine, useChannelRun } from "./runs";
import {
  MAKE_INTO_OUTLET,
  NOT_PLACED,
  PIECE_FORM_OUTLETS,
  PLAN_OUTLETS,
  ROUTINES_COL,
  type GridCol,
  type GridItem,
  type GridPieceRef,
  type GridRow,
} from "./grid-data";

/**
 * The site Channel's one table (developer, 2026-11-15): Board (pieces × outlets), Queue by week
 * (days × content kinds, a Routines column first) and Queue by piece (outlet types × days). A
 * square opens a form at once ("form to form, like Studio"): the piece's own quick form for Site,
 * Shop and ArtDirect, Make into for Video, Writing and Live, and "Plan a post" for an outlet that
 * posts (`channel-delivery-save`, a draft). A routine's open slot is filled from its square
 * (`channel-slot-fill`). A piece's name opens the manage-piece pop-up. Plans only.
 */

const WORD: Record<GridItem["state"], string> = {
  out: "out",
  scheduled: "scheduled",
  planned: "planned",
  draft: "draft",
  failed: "did not go",
  suggested: "suggested",
  slot: "open slot",
};
const SHORT_OUTLET: Partial<Record<GridItem["outlet"], string>> = { instagram: "IG", facebook: "FB", threads: "Threads", newsletter: "Letter", market: "Shop", page: "Page", youtube: "YT" };
const SHORT_WORD: Record<GridItem["state"], string> = { out: "out", scheduled: "sched.", planned: "planned", draft: "draft", failed: "failed", suggested: "sugg.", slot: "open" };
const short = (o: GridItem["outlet"]) => SHORT_OUTLET[o] ?? outletLabel(o);
const clip = (t: string, n = 16) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

export type PillStyle = "date" | "piece" | "time" | "compact";

type Open = { row: GridRow; col: GridCol };

export interface ChannelGridProps {
  cols: GridCol[];
  rows: GridRow[];
  timeZone: string;
  caption: string;
  pill: PillStyle;
  /** Routine names the Routines column shows at first (Queue by week); the reader picks. */
  routineNames?: string[];
  /** Where routines are set up (the network Channel's Routines, through the hand-off). */
  routinesHref?: string | null;
  /** Every piece, for filling a routine slot. */
  pieces: GridPieceRef[];
  /**
   * "compact" (Home's Board pane, the hub card): the piece column is the title only (two lines, no thumbnail,
   * ~150px, sticky), and date pills become a state dot and the day. Same clicks, same square dialog.
   */
  density?: "normal" | "compact";
}

export function ChannelGrid({ cols, rows, timeZone, caption, pill: pillIn, routineNames = [], routinesHref, pieces, density = "normal" }: ChannelGridProps) {
  const compact = density === "compact";
  const pill: PillStyle = compact && pillIn === "date" ? "compact" : pillIn;
  const [open, setOpen] = React.useState<Open | null>(null);
  const [shown, setShown] = React.useState<Set<string>>(() => new Set(routineNames));
  const hasRoutines = cols.some((c) => c.routines);
  const visible = (c: GridCol, items: GridItem[]) => (c.routines ? items.filter((i) => !i.routineName || shown.has(i.routineName)) : items);
  const firstHead = rows[0]?.outlet ? "Type" : rows[0]?.date !== undefined ? "Day" : "Piece";

  return (
    <>
      {hasRoutines ? (
        <div className="kch-routines" role="group" aria-label="Routines shown">
          <span className="kch-eb">Routines</span>
          {routineNames.map((n) => (
            <button
              key={n}
              type="button"
              className="kch-chip"
              aria-pressed={shown.has(n)}
              onClick={() =>
                setShown((s) => {
                  const next = new Set(s);
                  if (next.has(n)) next.delete(n);
                  else next.add(n);
                  return next;
                })
              }
            >
              {n}
            </button>
          ))}
          {routinesHref ? (
            <a className="kch-fine" href={routinesHref}>
              Set up routines ↗
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="kch-board-wrap">
        <table className="kch-grid" data-pill={pill} data-density={compact ? "compact" : undefined}>
          <caption className="kch-sr">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{firstHead}</th>
              {cols.map((c) => (
                <th key={c.id} scope="col" data-today={c.today ? "1" : undefined} data-unplaced={c.id === NOT_PLACED ? "1" : undefined} data-routines={c.routines ? "1" : undefined}>
                  {c.label}
                  {c.sub ? <small>{c.sub}</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-today={row.today ? "1" : undefined}>
                <th scope="row">
                  {row.manageHref ? (
                    <Link href={row.manageHref} className="kch-grid-piece" scroll={false} title="Manage this piece">
                      <Head row={row} compact={compact} />
                    </Link>
                  ) : (
                    <span className="kch-grid-piece">
                      <Head row={row} compact={compact} />
                    </span>
                  )}
                </th>
                {cols.map((c) => {
                  const items = visible(c, row.cells[c.id] ?? []);
                  const routineCell = c.routines;
                  return (
                    <td key={c.id} data-today={c.today ? "1" : undefined} data-routines={routineCell ? "1" : undefined}>
                      {routineCell && row.id === NOT_PLACED ? null : (
                        <Cell
                          items={items}
                          pill={routineCell ? "time" : pill}
                          tz={timeZone}
                          label={`${row.head.title}, ${c.label}`}
                          href={directHref(row, c)}
                          disabled={routineCell && !items.some((i) => i.state === "slot")}
                          onOpen={() => setOpen({ row, col: c })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? <CellDialog open={open} tz={timeZone} pieces={pieces} shownRoutines={shown} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** The square's outlet when the row or column fixes one. */
function outletOf(row: GridRow, col: GridCol): GridItem["outlet"] | null {
  return row.outlet ?? col.outlets?.[0] ?? null;
}

/** A square that is answered by a form elsewhere: the piece's quick form (Site, Shop, ArtDirect) or Make into. */
function directHref(row: GridRow, col: GridCol): string | null {
  const o = outletOf(row, col);
  if (!o || !row.piece) return null;
  if (PIECE_FORM_OUTLETS.includes(o)) return row.editHref ?? row.manageHref ?? null;
  const to = MAKE_INTO_OUTLET[o];
  return to ? row.makeInto?.[to] ?? null : null;
}

function Head({ row, compact = false }: { row: GridRow; compact?: boolean }) {
  const h = row.head;
  if (compact)
    return (
      <span className="kch-grid-name" title={h.line ? `${h.title} · ${h.line}` : h.title}>
        {h.title}
      </span>
    );
  return (
    <>
      {h.showThumb ? h.imageUrl ? <img className="kch-thumb" src={mediaThumbnail(h.imageUrl, 128)} alt="" loading="lazy" style={{ width: 40, height: 40 }} /> : <span className="kch-thumb" aria-hidden="true" style={{ width: 40, height: 40 }} /> : null}
      <span className="kch-grid-name">
        {h.title}
        {h.line ? <span className="kch-fine">{h.line}</span> : null}
      </span>
    </>
  );
}

function pillTitle(i: GridItem, tz: string): string {
  return [i.piece?.title, i.routineName, outletLabel(i.outlet), WORD[i.state], i.at ? `${fmtDay(i.at, tz)} ${fmtTime(i.at, tz)}` : null, i.label].filter(Boolean).join(" · ");
}

function pillText(i: GridItem, pill: PillStyle, tz: string): string {
  if (i.state === "slot") return `${i.routineName ? clip(i.routineName, 12) : short(i.outlet)} · open${i.at ? ` ${fmtTime(i.at, tz)}` : ""}`;
  if (pill === "piece") return `${i.piece ? clip(i.piece.title) : ""} · ${short(i.outlet)} ${SHORT_WORD[i.state]}`;
  if (pill === "time") return i.at ? `${SHORT_WORD[i.state]} · ${fmtTime(i.at, tz)}` : SHORT_WORD[i.state];
  // Home's compact Board: the mark carries the state (a dot); the words are only the day.
  if (pill === "compact") return i.at ? fmtDay(i.at, tz) : SHORT_WORD[i.state];
  return i.at ? `${SHORT_WORD[i.state]} · ${fmtDay(i.at, tz)}` : SHORT_WORD[i.state];
}

function Cell({ items, pill, tz, label, href, onOpen, disabled }: { items: GridItem[]; pill: PillStyle; tz: string; label: string; href: string | null; onOpen: () => void; disabled?: boolean }) {
  const words = items.map((i) => pillTitle(i, tz)).join("; ");
  const body = (
    <>
      {items.length === 0 ? (
        disabled ? null : (
          <span className="kch-cell-plus" aria-hidden="true">
            +
          </span>
        )
      ) : (
        items.slice(0, 3).map((i) => (
          <span key={i.id} className="kch-mark" data-state={i.state} title={pillTitle(i, tz)}>
            {pillText(i, pill, tz)}
          </span>
        ))
      )}
      {items.length > 3 ? <span className="kch-fine">+{items.length - 3}</span> : null}
    </>
  );
  if (href)
    return (
      <Link className="kch-cell" href={href} scroll={false} aria-label={items.length ? `${label}: ${words}` : `Edit ${label}`}>
        {body}
      </Link>
    );
  return (
    <button type="button" className="kch-cell" onClick={onOpen} disabled={disabled && items.length === 0} aria-label={items.length ? `${label}: ${words}` : `Plan ${label}`}>
      {body}
    </button>
  );
}

// ── the square's form ────────────────────────────────────────────────────────

function tomorrowAtTen(tz: string): string {
  return `${toZonedInput(new Date(Date.now() + 86_400_000).toISOString(), tz).slice(0, 10)}T10:00`;
}

function CellDialog({ open, tz, pieces, shownRoutines, onClose }: { open: Open; tz: string; pieces: GridPieceRef[]; shownRoutines: Set<string>; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const { row, col } = open;
  const titleId = "kch-cell-title";
  const where = row.outlet ? outletLabel(row.outlet) : col.outlets ? col.label : col.routines ? "Routines" : col.label;
  const heading = row.piece ? `${where} · ${row.piece.title}${row.outlet ? ` · ${col.label}` : ""}` : `${where} · ${row.head.title}`;
  const done = () => ref.current?.close();
  return (
    <dialog
      ref={ref}
      className="kch-dialog"
      aria-labelledby={titleId}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onCancel={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="kch-dialog-head">
        <h2 className="kch-h3" id={titleId}>
          {heading}
        </h2>
        <button type="button" className="kch-icon-btn" aria-label="Close" onClick={done}>
          ✕
        </button>
      </div>
      {col.id === ROUTINES_COL ? (
        <SlotForm items={(row.cells[col.id] ?? []).filter((i) => !i.routineName || shownRoutines.has(i.routineName))} tz={tz} pieces={pieces} done={done} />
      ) : (
        <PlanForm row={row} col={col} tz={tz} done={done} />
      )}
    </dialog>
  );
}

function ItemLine({ i, tz, networkHref, onEdit, onAccept, onDismiss, busy }: { i: GridItem; tz: string; networkHref: string | null; onEdit?: () => void; onAccept?: () => void; onDismiss?: () => void; busy: boolean }) {
  return (
    <li className="kch-dialog-item">
      <span className="kch-mark" data-state={i.state}>
        {WORD[i.state]}
      </span>
      <span className="kch-dialog-item-text">
        {i.piece ? <b>{i.piece.title}: </b> : null}
        {i.label}
        <span className="kch-fine">
          {" "}
          · {outletLabel(i.outlet)}
          {i.at ? ` · ${fmtDay(i.at, tz)} ${fmtTime(i.at, tz)}` : ""}
        </span>
      </span>
      <span className="kch-dialog-item-acts">
        {i.state === "out" && i.href ? (
          <a className="kch-btn kch-btn--plain kch-btn--sm" href={i.href}>
            View ↗
          </a>
        ) : null}
        {(i.state === "scheduled" || i.state === "failed") && networkHref ? (
          <a className="kch-btn kch-btn--plain kch-btn--sm" href={networkHref}>
            {i.state === "failed" ? "Retry" : "Change"} ↗
          </a>
        ) : null}
        {i.state === "suggested" && onAccept ? (
          <button type="button" className="kch-btn kch-btn--sm" disabled={busy} onClick={onAccept}>
            Accept
          </button>
        ) : null}
        {(i.state === "suggested" || i.state === "planned" || i.state === "draft") && onEdit && PLAN_OUTLETS.includes(i.outlet) ? (
          <button type="button" className="kch-btn kch-btn--ghost kch-btn--sm" disabled={busy} onClick={onEdit}>
            Edit
          </button>
        ) : null}
        {i.state === "suggested" && onDismiss ? (
          <button type="button" className="kch-icon-btn" aria-label={`Dismiss: ${i.label}`} disabled={busy} onClick={onDismiss}>
            ✕
          </button>
        ) : null}
      </span>
    </li>
  );
}

function PlanForm({ row, col, tz, done }: { row: GridRow; col: GridCol; tz: string; done: () => void }) {
  const { busy, note, run } = useChannelRun();
  const items = row.cells[col.id] ?? [];
  // The piece: the row's (Board, Queue by piece) or one of the column's kind (Queue by week).
  const choicesOfPiece: GridPieceRef[] = row.piece ? [row.piece] : col.pieces ?? [];
  const fixedOutlet = outletOf(row, col);
  const outlets = fixedOutlet ? (PLAN_OUTLETS.includes(fixedOutlet) ? [fixedOutlet] : []) : [...PLAN_OUTLETS.filter((o) => o !== "threads")];
  const first = items.find((i) => (i.state === "planned" || i.state === "draft" || i.state === "suggested") && outlets.includes(i.outlet)) ?? null;
  const [pieceKey, setPieceKey] = React.useState(first?.piece?.key ?? choicesOfPiece[0]?.key ?? "");
  const piece = choicesOfPiece.find((p) => p.key === pieceKey) ?? null;
  const [outlet, setOutlet] = React.useState(first?.outlet ?? outlets[0] ?? "instagram");
  const [text, setText] = React.useState(first?.label ?? (piece ? `${outletLabel(outlets[0] ?? "instagram")}: ${piece.title}` : ""));
  const day = row.date !== undefined ? row.date : col.date;
  const [when, setWhen] = React.useState(() => (first?.at ? toZonedInput(first.at, tz) : day ? `${day}T10:00` : tomorrowAtTen(tz)));

  const edit = (i: GridItem) => {
    if (i.piece) setPieceKey(i.piece.key);
    setOutlet(i.outlet);
    setText(i.label);
    if (i.at) setWhen(toZonedInput(i.at, tz));
  };
  const who = (i: GridItem) => i.piece ?? row.piece ?? null;

  return (
    <div className="kch-dialog-body">
      {items.length > 0 ? (
        <ul className="kch-dialog-list">
          {items.map((i) => {
            const p = who(i);
            return (
              <ItemLine
                key={i.id}
                i={i}
                tz={tz}
                networkHref={i.networkHref ?? row.networkHref ?? null}
                busy={busy !== null}
                onEdit={() => edit(i)}
                onAccept={
                  i.suggestion && p
                    ? async () => {
                        const s = i.suggestion!;
                        if (await run("accept", "channel-suggestion-accept", { pieceKey: p.key, identityId: p.identityId, outlet: s.outlet, text: s.text, at: s.at, routineId: s.routineId }, "Planned.")) done();
                      }
                    : undefined
                }
                onDismiss={
                  i.suggestion && p
                    ? async () => {
                        const s = i.suggestion!;
                        if (await run("dismiss", "channel-suggestion-dismiss", { pieceKey: p.key, identityId: p.identityId, outlet: s.outlet, text: s.text }, "Dismissed.")) done();
                      }
                    : undefined
                }
              />
            );
          })}
        </ul>
      ) : null}

      {outlets.length > 0 && choicesOfPiece.length > 0 ? (
        <form
          className="kch-plan-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!piece) return;
            const at = when ? fromZonedInput(when, tz) : null;
            if (await run("save", "channel-delivery-save", { pieceKey: piece.key, identityId: piece.identityId, outlet, text, at }, "Planned.")) done();
          }}
        >
          <p className="kch-eb">Plan a post</p>
          {choicesOfPiece.length > 1 ? (
            <label>
              <span className="kch-fine">Piece</span>
              <select value={pieceKey} onChange={(e) => setPieceKey(e.target.value)}>
                {choicesOfPiece.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {outlets.length > 1 ? (
            <label>
              <span className="kch-fine">Where</span>
              <select value={outlet} onChange={(e) => setOutlet(e.target.value as typeof outlet)}>
                {outlets.map((o) => (
                  <option key={o} value={o}>
                    {outletLabel(o)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span className="kch-fine">When</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label>
            <span className="kch-fine">What goes out</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} required maxLength={2200} />
          </label>
          <div className="kch-plan-form-foot">
            <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null || !text.trim() || !piece}>
              {busy === "save" ? "Saving…" : "Save as a plan"}
            </button>
          </div>
        </form>
      ) : null}
      <NoteLine note={note} />
    </div>
  );
}

function SlotForm({ items, tz, pieces, done }: { items: GridItem[]; tz: string; pieces: GridPieceRef[]; done: () => void }) {
  const { busy, note, run } = useChannelRun();
  const slots = items.filter((i) => i.state === "slot" && i.routineId && i.at);
  const booked = items.filter((i) => i.state !== "slot");
  const [slotId, setSlotId] = React.useState(slots[0]?.id ?? "");
  const slot = slots.find((s) => s.id === slotId) ?? null;
  const [pieceKey, setPieceKey] = React.useState(slot?.suggestion?.pieceKey ?? pieces[0]?.key ?? "");
  const [text, setText] = React.useState(slot?.suggestion?.text ?? "");
  const title = pieces.find((p) => p.key === pieceKey)?.title ?? "";
  return (
    <div className="kch-dialog-body">
      {booked.length > 0 ? (
        <ul className="kch-dialog-list">
          {booked.map((i) => (
            <ItemLine key={i.id} i={i} tz={tz} networkHref={null} busy={busy !== null} />
          ))}
        </ul>
      ) : null}
      {slot ? (
        <form
          className="kch-plan-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("fill", "channel-slot-fill", { routineId: slot.routineId, at: slot.at, pieceKey, text: text.trim() || undefined }, "Filled.")) done();
          }}
        >
          <p className="kch-eb">Fill a slot</p>
          {slots.length > 1 ? (
            <label>
              <span className="kch-fine">Slot</span>
              <select
                value={slotId}
                onChange={(e) => {
                  setSlotId(e.target.value);
                  const s = slots.find((x) => x.id === e.target.value);
                  if (s?.suggestion?.pieceKey) setPieceKey(s.suggestion.pieceKey);
                }}
              >
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.routineName ?? outletLabel(s.outlet)} · {fmtTime(s.at, tz)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="kch-fine">
              {slot.routineName ?? outletLabel(slot.outlet)} · {fmtTime(slot.at, tz)}
            </p>
          )}
          <label>
            <span className="kch-fine">With</span>
            <select value={pieceKey} onChange={(e) => setPieceKey(e.target.value)}>
              {pieces.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="kch-fine">What goes out (optional)</span>
            <textarea rows={3} value={text} placeholder={`${outletLabel(slot.outlet)}: ${title}`} onChange={(e) => setText(e.target.value)} maxLength={200} />
          </label>
          <div className="kch-plan-form-foot">
            <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null || !pieceKey}>
              {busy === "fill" ? "Filling…" : "Fill the slot"}
            </button>
          </div>
        </form>
      ) : null}
      <NoteLine note={note} />
    </div>
  );
}
