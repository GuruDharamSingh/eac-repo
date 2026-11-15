import { PIECE_KINDS, kindLabel, fmtLong, type ChannelModel, type Outlet, type Piece, type PieceKind, type Suggestion, type TimelineEntry } from "../model";
import { outletLabel } from "../labels";
import { BOARD_COLUMNS, markOf } from "./view";

/**
 * The site Channel's one table (developer, 2026-11-15): Board and Queue are a toggle over the same
 * grid. Board: pieces down, outlets across. Queue by week: the week's days down, content kinds
 * across (a Routines column first). Queue by piece: one piece, its outlet types down, days across,
 * with routines and plan steps beside. A square opens a form at once: the piece's quick form (Site,
 * Shop, ArtDirect), Make into (Video, Writing, Live), or "Plan a post" for an outlet that posts.
 * A piece's name opens the manage-piece pop-up. Pure: built on the server, drawn by grid.tsx.
 */

export type GridState = "out" | "scheduled" | "planned" | "draft" | "failed" | "suggested" | "slot";

export interface GridPieceRef {
  key: string;
  title: string;
  identityId: string;
}

export interface GridItem {
  id: string;
  state: GridState;
  outlet: Outlet;
  label: string;
  at: string | null;
  href: string | null;
  /** A suggestion (state "suggested"), or the one an open routine slot carries. */
  suggestion?: Suggestion | null;
  /** An open routine slot (state "slot"), and the routine's name. */
  routineId?: string | null;
  routineName?: string | null;
  /** The item's piece, where the row is not one piece (Queue by week). */
  piece?: GridPieceRef | null;
  /** Where a scheduled or failed post is changed (the network Channel's piece board). */
  networkHref?: string | null;
}

export interface GridCol {
  id: string;
  label: string;
  sub?: string | null;
  /** Board: the column's outlets (the first is what a new plan uses). */
  outlets?: readonly Outlet[];
  /** Queue by piece: the column's day, "YYYY-MM-DD" in the channel's zone ("" for not placed yet). */
  date?: string;
  today?: boolean;
  /** Queue by week: a content kind's column and the pieces a new plan can be about. */
  kind?: PieceKind;
  pieces?: GridPieceRef[];
  /** Queue by week: the routines' column (open slots and what is booked in them). */
  routines?: boolean;
}

export interface GridRow {
  id: string;
  head: { title: string; line?: string | null; imageUrl?: string | null; kind?: PieceKind | null; showThumb: boolean };
  /** The row's piece (Board, Queue by piece); absent on a day row (Queue by week). */
  piece?: GridPieceRef | null;
  /** The manage-piece pop-up. */
  manageHref?: string | null;
  /** The pop-up opened on its quick form (or Studio when the site has none for the kind). */
  editHref?: string | null;
  /** Make into this piece's video or writing (Studio's /studio/make). */
  makeInto?: Partial<Record<"video" | "writing", string>>;
  /** Queue by piece: the row's outlet type. */
  outlet?: Outlet | null;
  /** Queue by week: the row's day ("" for not placed). */
  date?: string;
  today?: boolean;
  cells: Record<string, GridItem[]>;
  networkHref?: string | null;
}

export interface RowLinks {
  manageHref: (p: Piece) => string;
  editHref: (p: Piece) => string;
  makeIntoHref: (p: Piece, to: "video" | "writing") => string;
  networkHref: (p: Piece) => string;
}

export interface GridRoutine {
  id: string;
  name: string;
  cadence: string;
  outlet: Outlet;
  /** Day → open slots and booked posts that day. */
  cells: Record<string, GridItem[]>;
}

/** The outlets a site plans posts on. Site, Shop and pages publish from the piece itself (its quick form). */
export const PLAN_OUTLETS: readonly Outlet[] = ["instagram", "facebook", "newsletter", "threads"];
/** Outlets a square answers with the piece's own form, and with Make into. */
export const PIECE_FORM_OUTLETS: readonly Outlet[] = ["site", "market", "page"];
export const MAKE_INTO_OUTLET: Partial<Record<Outlet, "video" | "writing">> = { video: "video", live: "video", writing: "writing", youtube: "video" };

/** Rows of Queue by piece: the outlet types going down. */
export const PIECE_ROWS: readonly Outlet[] = ["site", "instagram", "facebook", "newsletter", "video", "writing", "live"];

export const NOT_PLACED = "unplaced";
export const ROUTINES_COL = "routines";

/** "YYYY-MM-DD" of an instant on the wall clock of `timeZone`. */
export function zonedDay(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** A day heading, "Sat 14 Nov". */
export function dayHeading(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d).replace(",", "");
}

const refOf = (p: Piece): GridPieceRef => ({ key: p.key, title: p.title || "Untitled", identityId: p.ownerIdentityId });

function itemOf(e: TimelineEntry, p: Piece | null = null, networkHref: string | null = null): GridItem | null {
  const m = e.state === "failed" ? "failed" : markOf(e);
  if (!m) return null;
  return { id: e.id, state: m, outlet: e.outlet, label: e.label, at: e.at, href: e.href, piece: p ? refOf(p) : null, networkHref };
}

function suggestedOf(s: Suggestion, p: Piece | null = null): GridItem {
  return { id: `s:${s.id}`, state: "suggested", outlet: s.outlet, label: s.text, at: s.at, href: null, suggestion: s, piece: p ? refOf(p) : null };
}

function rowHead(p: Piece, tz: string): GridRow["head"] {
  const line = [kindLabel(p.kind), p.eventAt ? fmtLong(p.eventAt, tz) : p.meta !== kindLabel(p.kind) ? p.meta : null, p.status].filter(Boolean).join(" · ");
  return { title: p.title || "Untitled", line, imageUrl: p.imageUrl, kind: p.kind, showThumb: true };
}

function pieceRowLinks(p: Piece, o: RowLinks): Pick<GridRow, "piece" | "manageHref" | "editHref" | "makeInto" | "networkHref"> {
  return {
    piece: refOf(p),
    manageHref: o.manageHref(p),
    editHref: o.editHref(p),
    makeInto: { video: o.makeIntoHref(p, "video"), writing: o.makeIntoHref(p, "writing") },
    networkHref: o.networkHref(p),
  };
}

const ORDER: Record<GridState, number> = { failed: 0, out: 1, scheduled: 2, planned: 3, draft: 4, slot: 5, suggested: 6 };
const byOrder = (a: GridItem, b: GridItem) => ORDER[a.state] - ORDER[b.state] || (a.at ?? "~").localeCompare(b.at ?? "~");

/** Board: pieces × outlets. A square holds what is there (newest first), else the Queue's suggestion for that gap. */
export function boardGrid(model: ChannelModel, pieces: Piece[], o: RowLinks): { cols: GridCol[]; rows: GridRow[] } {
  const cols: GridCol[] = BOARD_COLUMNS.map((c) => ({ id: c.id, label: c.label, sub: null, outlets: c.outlets }));
  const rows = pieces.map((p) => {
    const cells: Record<string, GridItem[]> = {};
    for (const c of BOARD_COLUMNS) {
      const here = p.timeline
        .filter((e) => c.outlets.includes(e.outlet))
        .map((e) => itemOf(e))
        .filter((x): x is GridItem => x !== null)
        .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
      const gaps = here.length === 0 ? p.suggestions.filter((s) => c.outlets.includes(s.outlet)).map((s) => suggestedOf(s)) : [];
      cells[c.id] = [...here.slice(0, 2), ...gaps.slice(0, 1)];
    }
    return { id: p.key, head: rowHead(p, model.timeZone), cells, ...pieceRowLinks(p, o) } satisfies GridRow;
  });
  return { cols, rows };
}

/** The Queue's day columns (Queue by piece) for the model's week, and "Not placed". */
export function weekCols(model: ChannelModel): GridCol[] {
  const cols: GridCol[] = model.week.days.map((d) => ({ id: d.date, label: dayHeading(d.date), sub: d.isToday ? "today" : d.isTomorrow ? "tomorrow" : null, date: d.date, today: d.isToday }));
  cols.push({ id: NOT_PLACED, label: "Not placed", sub: "no date yet", date: "" });
  return cols;
}

function routineItems(model: ChannelModel): Map<string, GridItem[]> {
  const byName = new Map(model.routines.map((r) => [r.name, r]));
  const out = new Map<string, GridItem[]>(model.week.days.map((d) => [d.date, []]));
  for (const d of model.week.days) {
    for (const it of d.items) {
      if (it.type === "slot") {
        out.get(d.date)!.push({ id: it.id, state: "slot", outlet: it.outlet, label: it.suggestion?.text ?? `Open ${outletLabel(it.outlet)} slot`, at: it.at, href: null, suggestion: it.suggestion, routineId: it.routineId, routineName: it.routineName });
      } else if (it.type === "post" && it.routineName && byName.has(it.routineName)) {
        const state: GridState = it.state === "published" ? "out" : it.state === "scheduled" || it.state === "live" ? "scheduled" : it.state === "failed" ? "failed" : "planned";
        out.get(d.date)!.push({ id: it.id, state, outlet: it.outlets[0] ?? "instagram", label: it.pieceTitle ? `${it.pieceTitle}: ${it.title}` : it.title, at: it.at, href: it.href, routineName: it.routineName });
      }
    }
  }
  for (const v of out.values()) v.sort((a, b) => (a.at ?? "~").localeCompare(b.at ?? "~"));
  return out;
}

/**
 * Queue by week (developer, 2026-11-15: "content kinds over to the horizontal axis"): the week's
 * days down (and "Not placed"), the kinds of piece across, a Routines column first. A square holds
 * every piece of that kind out, planned or suggested that day; a new plan there picks the piece.
 */
export function weekGrid(model: ChannelModel, pieces: Piece[], o: RowLinks): { cols: GridCol[]; rows: GridRow[] } {
  const tz = model.timeZone;
  const kinds = PIECE_KINDS.map((k) => k.id).filter((k) => pieces.some((p) => p.kind === k));
  const cols: GridCol[] = [];
  if (model.routines.length > 0) cols.push({ id: ROUTINES_COL, label: "Routines", sub: null, routines: true });
  for (const k of kinds) {
    const of = pieces.filter((p) => p.kind === k);
    cols.push({ id: k, label: kindLabel(k), sub: of.length === 1 ? "1 piece" : `${of.length} pieces`, kind: k, pieces: of.map(refOf) });
  }
  const days = model.week.days.map((d) => ({ id: d.date, head: { title: dayHeading(d.date), line: d.isToday ? "today" : d.isTomorrow ? "tomorrow" : null, showThumb: false }, date: d.date, today: d.isToday }));
  const rows: GridRow[] = [...days, { id: NOT_PLACED, head: { title: "Not placed", line: "no date yet", showThumb: false }, date: "", today: false }].map((r) => ({
    ...r,
    cells: Object.fromEntries(cols.map((c) => [c.id, [] as GridItem[]])),
  }));
  const rowOf = new Map(rows.map((r) => [r.id, r]));
  for (const p of pieces) {
    const net = o.networkHref(p);
    for (const e of p.timeline) {
      const day = zonedDay(e.at, tz);
      const it = itemOf(e, p, net);
      if (it && day && rowOf.has(day)) rowOf.get(day)!.cells[p.kind].push(it);
    }
    for (const s of p.suggestions) {
      const day = zonedDay(s.at, tz);
      const row = day && rowOf.has(day) ? rowOf.get(day)! : !s.at ? rowOf.get(NOT_PLACED)! : null;
      row?.cells[p.kind].push(suggestedOf(s, p));
    }
  }
  if (model.routines.length > 0) for (const [day, items] of routineItems(model)) rowOf.get(day)?.cells[ROUTINES_COL].push(...items);
  for (const r of rows) for (const k of Object.keys(r.cells)) r.cells[k].sort(byOrder);
  return { cols, rows };
}

function dayCells(p: Piece, cols: GridCol[], tz: string, only: Outlet): Record<string, GridItem[]> {
  const ids = new Set(cols.map((c) => c.id));
  const cells: Record<string, GridItem[]> = Object.fromEntries(cols.map((c) => [c.id, [] as GridItem[]]));
  const match = (o: Outlet) => o === only || (only === "facebook" && o === "threads");
  for (const e of p.timeline) {
    if (!match(e.outlet)) continue;
    const it = itemOf(e);
    const day = zonedDay(e.at, tz);
    if (it && day && ids.has(day)) cells[day].push(it);
  }
  for (const s of p.suggestions) {
    if (!match(s.outlet)) continue;
    const day = zonedDay(s.at, tz);
    const col = day && ids.has(day) ? day : !s.at ? NOT_PLACED : null;
    if (col && ids.has(col)) cells[col].push(suggestedOf(s));
  }
  for (const k of Object.keys(cells)) cells[k].sort(byOrder);
  return cells;
}

/** Queue by piece: one piece, its outlet types down, the week's days across. */
export function pieceGrid(model: ChannelModel, p: Piece, o: RowLinks): { cols: GridCol[]; rows: GridRow[] } {
  const cols = weekCols(model);
  const links = pieceRowLinks(p, o);
  const rows = PIECE_ROWS.map((outlet) => ({
    id: `${p.key}|${outlet}`,
    head: { title: outletLabel(outlet), line: null, imageUrl: null, kind: null, showThumb: false },
    outlet,
    cells: dayCells(p, cols, model.timeZone, outlet),
    ...links,
    manageHref: null,
  }));
  return { cols, rows };
}

/** The routines over the week (Queue by piece's Routines panel). */
export function routineRows(model: ChannelModel): GridRoutine[] {
  const byDay = routineItems(model);
  return model.routines.map((r) => ({
    id: r.id,
    name: r.name,
    cadence: r.cadence,
    outlet: r.outlet,
    cells: Object.fromEntries([...byDay].map(([day, items]) => [day, items.filter((i) => i.routineId === r.id || i.routineName === r.name)])),
  }));
}
