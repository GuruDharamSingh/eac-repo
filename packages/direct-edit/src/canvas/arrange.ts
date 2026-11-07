// ============================================================================
// Rearranging the inside of a sealed block, in the popup (2026-11-04). No new layout
// system: the words below are shortcuts onto the look a box already has (`layout`,
// `dir`, `gcols`, `order`, `pos`, `self` in block/style.ts), stored in the node's
// morph per part, drawn by the same scoped stylesheet, so the published markup does
// not change. Dragging is box-drag.ts's startBoxMove.
//
// CSS sets the limit, and the panel says so in words: `order` moves a part only among
// the children of the element around it, and a part cannot leave that element.
// ============================================================================

import { ROOT_PART } from "../block/contract";
import { partLookOf, setPartLook } from "../block/morph";
import { declsToString, safeDecls, type PartStyle } from "../block/style";
import { drawnOrder } from "./box-drag";
import { partKind, type PartHit } from "./parts";

type Props = Record<string, unknown>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export type Shape = "stack" | "row" | "c2" | "c3" | "built" | "picl" | "picr";
const SHAPES: Array<[Shape, string]> = [["stack", "Stack"], ["row", "Row"], ["c2", "2 columns"], ["c3", "3 columns"], ["built", "As built"]];
const PICTURE_SHAPES: Array<[Shape, string]> = [["picl", "Picture left"], ["picr", "Picture right"]];

export interface ArrangeKid { name: string; label: string; els: HTMLElement[] }
/** What one element holds, as the page draws it now. */
export interface Holding {
  holder: HTMLElement;
  /** Its name as a part, or null when the block's code has it and no part does. */
  holderName: string | null;
  /** Parts in the flow, in drawn order: these can change places. */
  kids: ArrangeKid[];
  /** Parts lying behind or over the others (`position: absolute`). */
  behind: ArrangeKid[];
  /** Children in the flow that no part names. */
  loose: number;
  /** The picture of a Picture left or right shape: it has its own column, so it is not in the order. */
  placed: ArrangeKid | null;
}

const isOverlay = (el: Element) => /absolute|fixed/.test(getComputedStyle(el).position);
const isLaidOut = (el: Element) => /flex|grid/.test(getComputedStyle(el).display);

export function holdingOf(nodeEl: HTMLElement, holder: HTMLElement, owners: Map<HTMLElement, PartHit>, props?: Props): Holding {
  const out: Holding = { holder, holderName: holder === nodeEl ? ROOT_PART : owners.get(holder)?.name ?? null, kids: [], behind: [], loose: 0, placed: null };
  const add = (list: ArrangeKid[], hit: PartHit, el: HTMLElement) => {
    const had = list.find((k) => k.name === hit.name);
    if (had) had.els.push(el); else list.push({ name: hit.name, label: hit.part.label, els: [el] });
  };
  for (const el of drawnOrder(holder)) {
    const hit = owners.get(el);
    if (hit) add(isOverlay(el) ? out.behind : out.kids, hit, el);
    else if (!isOverlay(el)) out.loose++;
  }
  if (props && out.holderName && isPictureShape(shapeOf(partLookOf(props, out.holderName)))) {
    const pic = pictureOf(out);
    if (pic && out.kids.includes(pic)) { out.placed = pic; out.kids = out.kids.filter((k) => k !== pic); }
  }
  return out;
}

/** A repeated part holds different things card by card, a card with no picture for one. The fullest shows what there is to arrange. */
export function fullestOf(el: HTMLElement, owners: Map<HTMLElement, PartHit>): HTMLElement {
  const name = owners.get(el)?.name;
  if (!name) return el;
  const held = (e: HTMLElement) => new Set(Array.from(e.children).map((c) => owners.get(c as HTMLElement)?.name).filter(Boolean)).size;
  let best = el, most = held(el);
  for (const [e, hit] of owners) {
    if (hit.name !== name) continue;
    const n = held(e);
    if (n > most) { best = e; most = n; }
  }
  return best;
}

// Picture left and right. The picture's column is as wide as the picture, so a card with no picture has no column and its
// words take the whole card. The width follows the card (`cqw`), so narrow cards and phones keep room for words. The last
// row takes what is left, which keeps the words together at the top beside a taller picture. A picture's own height must
// not set the card's: `height: 0` with `min-height: 100%` crops it to the words, with the card's `min-height` as the floor.
const PICTURE_COLUMNS = { picl: "auto minmax(0, 1fr)", picr: "minmax(0, 1fr) auto" } as const;
const PICTURE_WIDTH = "38cqw";
const PICTURE_GAP = 16;
const CARD_MIN_HEIGHT = "160px";
const CARD_MIN_WIDTH = "min(280px, 100%)";
const HOLDER_DECLS = new Set(["grid-template-columns", "grid-template-rows", "column-gap", "container-type", "min-height", "min-width"]);
const PLACE_DECLS = new Set(["grid-column", "grid-row"]);
const PICTURE_DECLS = new Set([...PLACE_DECLS, "width", "height", "min-height", "aspect-ratio", "object-fit", "margin"]);

const isPictureShape = (shape: Shape): shape is "picl" | "picr" => shape === "picl" || shape === "picr";

export const shapeOf = (s: PartStyle): Shape => {
  if (s.layout === "grid") {
    const cols = safeDecls(s.css).find(([k]) => k === "grid-template-columns")?.[1];
    if (cols === PICTURE_COLUMNS.picl) return "picl";
    if (cols === PICTURE_COLUMNS.picr) return "picr";
    return s.gcols === 3 ? "c3" : "c2";
  }
  return s.layout === "stack" ? (s.dir === "row" ? "row" : "stack") : "built";
};

/** The one picture this element holds, in the flow or lying behind. A list of pictures has no single one to place. */
function pictureOf(h: Holding): ArrangeKid | null {
  if (h.placed) return h.placed;
  return [...h.kids, ...h.behind].find((k) => k.els.length === 1 && partKind(k.els[0]!) === "image") ?? null;
}

const REPEAT_GAP = 16;
const CLEAR_ON_HOLDER = ["layout", "dir", "wrap", "gcols", "justify", "items", "gap"] as const;
const edit = (props: Props, name: string, fn: (s: PartStyle) => void) => {
  const s = { ...partLookOf(props, name) };
  fn(s);
  setPartLook(props, name, s);
};

/** Out from behind, into the flow beside the rest. A picture's own width must not hold the row open. */
export function setInLine(props: Props, name: string, on: boolean): void {
  edit(props, name, (s) => {
    const rest = safeDecls(s.css).filter(([k]) => k !== "min-width");
    if (on) { s.pos = "relative"; s.self = "stretch"; rest.push(["min-width", "0"]); }
    else { if (s.pos === "relative") delete s.pos; if (s.self === "stretch") delete s.self; }
    if (rest.length) s.css = declsToString(rest); else delete s.css;
  });
}

/** Takes these raw declarations out of a part's look and writes the new ones. */
function editDecls(props: Props, name: string, drop: Set<string>, add: Array<[string, string]> = []): void {
  edit(props, name, (s) => {
    const rest = safeDecls(s.css).filter(([k]) => !drop.has(k) && !add.some(([a]) => a === k));
    rest.push(...add);
    if (rest.length) s.css = declsToString(rest); else delete s.css;
  });
}

function clearPicture(props: Props, h: Holding): void {
  const pic = pictureOf(h);
  if (h.holderName) editDecls(props, h.holderName, HOLDER_DECLS);
  for (const k of [...h.kids, ...h.behind]) if (k !== pic) editDecls(props, k.name, PLACE_DECLS);
  if (pic) editDecls(props, pic.name, PICTURE_DECLS);
}

function placePicture(props: Props, h: Holding, shape: "picl" | "picr"): void {
  const pic = pictureOf(h);
  if (!pic || !h.holderName) return;
  const words = h.kids.filter((k) => k !== pic);
  editDecls(props, h.holderName, HOLDER_DECLS, [
    ["grid-template-columns", PICTURE_COLUMNS[shape]],
    ["grid-template-rows", `repeat(${words.length + h.loose}, auto) 1fr`],
    ["column-gap", "0"], ["container-type", "inline-size"],
    ["min-height", CARD_MIN_HEIGHT], ["min-width", CARD_MIN_WIDTH],
  ]);
  editDecls(props, pic.name, PICTURE_DECLS, [
    ["grid-column", shape === "picl" ? "1" : "2"], ["grid-row", "1 / -1"],
    ["width", PICTURE_WIDTH], ["height", "0"], ["min-height", "100%"], ["aspect-ratio", "auto"], ["object-fit", "cover"],
    ["margin", shape === "picl" ? `0 ${PICTURE_GAP}px 0 0` : `0 0 0 ${PICTURE_GAP}px`],
  ]);
  edit(props, pic.name, (s) => { delete s.order; });
  for (const k of words) editDecls(props, k.name, PLACE_DECLS, [["grid-column", shape === "picl" ? "2" : "1"]]);
}

/** Stack, Row or Columns on this element. A picture lying behind comes into line, or the shape would have nothing to place. "As built" takes all of it back. */
export function applyShape(props: Props, h: Holding, shape: Shape): void {
  if (!h.holderName) return;
  // Cards spaced by their own margins, with no gap on the holder, touch side by side and end unevenly: the holder's gap takes over.
  const cs = getComputedStyle(h.holder);
  const noGap = (cs.columnGap === "normal" || cs.columnGap === "0px") && h.kids.some((k) => k.els.length > 1);
  if (isPictureShape(shapeOf(partLookOf(props, h.holderName)))) clearPicture(props, h);
  edit(props, h.holderName, (s) => {
    const hadGap = s.gap;
    for (const k of CLEAR_ON_HOLDER) delete s[k];
    if (shape === "stack" || shape === "row") { s.layout = "stack"; s.dir = shape === "row" ? "row" : "column"; }
    else if (shape === "c2" || shape === "c3") { s.layout = "grid"; s.gcols = shape === "c3" ? 3 : 2; }
    else if (isPictureShape(shape)) s.layout = "grid";
    if (shape !== "built" && (noGap || hadGap !== undefined)) s.gap = hadGap ?? REPEAT_GAP;
  });
  if (noGap && shape !== "built") for (const k of h.kids) if (k.els.length > 1) edit(props, k.name, (s) => { if (s.margin === undefined) s.margin = 0; });
  if (shape === "built") {
    for (const k of [...h.kids, ...h.behind, ...(h.placed ? [h.placed] : [])]) {
      edit(props, k.name, (s) => { delete s.order; delete s.self; if (k.els.length > 1 && s.margin === 0) delete s.margin; });
      if (partLookOf(props, k.name).pos === "relative") setInLine(props, k.name, false);
    }
    return;
  }
  for (const k of h.behind) if (partKind(k.els[0]!) === "image") setInLine(props, k.name, true);
  if (isPictureShape(shape)) placePicture(props, h, shape);
  keepInline(props, h);
}

/** An inline part in a flex or grid container would stretch across it. It stays the size it was, where the text would put it. */
function keepInline(props: Props, h: Holding): void {
  const align = getComputedStyle(h.holder).textAlign;
  const self = align === "center" ? "center" : align === "right" || align === "end" ? "end" : "start";
  for (const k of h.kids) {
    if (getComputedStyle(k.els[0]!).display.startsWith("inline") && !partLookOf(props, k.name).self) edit(props, k.name, (s) => { s.self = self; });
  }
}

/** The parts in this new order. `order` draws only in a flex or grid container, so a plain one becomes a stack, which is how it already reads. False when that cannot be written. */
export function setSequence(props: Props, h: Holding, names: string[]): boolean {
  if (!isLaidOut(h.holder)) {
    if (!h.holderName) return false;
    edit(props, h.holderName, (s) => { s.layout = "stack"; s.dir = "column"; });
    keepInline(props, h);
  }
  // The block's own order again: nothing is left to store.
  const built = Array.from(h.holder.children).map((el) => h.kids.find((k) => k.els.includes(el as HTMLElement))?.name).filter((n): n is string => !!n);
  const own = [...new Set(built)].join() === names.join();
  names.forEach((name, i) => edit(props, name, (s) => { if (own) delete s.order; else s.order = i; }));
  return true;
}

/** One place earlier or later. */
export function moved(h: Holding, name: string, by: number): string[] | null {
  const names = h.kids.map((k) => k.name), at = names.indexOf(name), to = at + by;
  if (at < 0 || to < 0 || to >= names.length) return null;
  names.splice(at, 1);
  names.splice(to, 0, name);
  return names;
}

const inWords = (list: string[]) => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

/** Why this part has nothing to change places with, in words for the top bar and the panel. */
export function noSwapWords(label: string, around: Holding, aroundLabel: string): string {
  const same = around.kids.find((k) => k.label === label);
  if (same && same.els.length > 1) return `These ${same.els.length} follow the block's list, so they cannot change places with each other.`;
  return `${label} is the only thing that can move inside ${aroundLabel}, so it has nothing to change places with.`;
}

const row = (k: ArrangeKid, i: number, count: number) =>
  `<li><span class="de-arr-name">${esc(k.label)}${k.els.length > 1 ? ` <i>×${k.els.length}</i>` : ""}</span>` +
  `<button type="button" data-arr="move:${esc(k.name)}:-1" data-f="arr-up-${esc(k.name)}" aria-label="Move ${esc(k.label)} earlier" title="Earlier"${i === 0 ? " disabled" : ""}>↑</button>` +
  `<button type="button" data-arr="move:${esc(k.name)}:1" data-f="arr-down-${esc(k.name)}" aria-label="Move ${esc(k.label)} later" title="Later"${i === count - 1 ? " disabled" : ""}>↓</button></li>`;

/**
 * The panel's block for a selection: its shape and what it holds, then its own place among what is around it.
 * `inside` is what the selection holds; `around` is what holds the selection, with that element's label.
 */
export function arrangeHtml(a: { label: string; props: Props; inside: Holding; around: Holding | null; aroundLabel: string; declaresParts: boolean; nested: Array<{ holder: string; parts: string[] }> }): string {
  const { inside, around } = a;
  const count = [...inside.kids, ...inside.behind, ...(inside.placed ? [inside.placed] : [])].reduce((n, k) => n + k.els.length, 0) + inside.loose;
  const notes: string[] = [];
  let h = "";
  if (count >= 2 && inside.holderName) {
    const shape = shapeOf(partLookOf(a.props, inside.holderName));
    const pic = pictureOf(inside);
    const shapes = pic && inside.kids.some((k) => k !== pic) ? [...SHAPES, ...PICTURE_SHAPES] : SHAPES;
    h += `<div class="de-seg chips de-arr-shape" role="group" aria-label="Arrange">${shapes.map(([id, label]) => `<button type="button" data-arr="as:${id}" data-f="arr-${id}" aria-pressed="${shape === id}">${label}</button>`).join("")}</div>`;
  }
  if (inside.placed) notes.push(`${inside.placed.label} has its own column, 38% of the width. Without one, the words take the whole width.`);
  if (inside.kids.length >= 2) {
    h += `<ul class="de-arr-list" aria-label="Order">${inside.kids.map((k, i) => row(k, i, inside.kids.length)).join("")}</ul>`;
    notes.push("Or drag a part over another on the block.");
  } else if (inside.kids.length === 1 && inside.kids[0]!.els.length > 1) {
    const k = inside.kids[0]!;
    notes.push(`${k.label} ×${k.els.length} follow the block's list, so they cannot change places here. Stack, Row and Columns still apply.`);
  }
  for (const k of inside.behind) {
    const canLine = partKind(k.els[0]!) !== "frame";
    notes.push(`${k.label} lies behind the others${canLine ? "." : " and stays there."}${canLine ? ` <button type="button" class="de-arr-link" data-arr="line:${esc(k.name)}:1" data-f="arr-line-${esc(k.name)}">Bring it into line</button>` : ""}`);
  }
  for (const k of inside.kids) {
    if (partLookOf(a.props, k.name).pos === "relative") notes.push(`${k.label} is in line with the others. <button type="button" class="de-arr-link" data-arr="line:${esc(k.name)}:0" data-f="arr-line-${esc(k.name)}">Send it back behind</button>`);
  }
  if (inside.loose > 0 && inside.kids.length) notes.push(`${inside.loose === 1 ? "One more thing" : `${inside.loose} more things`} in here belong${inside.loose === 1 ? "s" : ""} to the block's code and stay${inside.loose === 1 ? "s" : ""} where ${inside.loose === 1 ? "it is" : "they are"}.`);
  for (const n of a.nested) notes.push(n.parts.length > 1 ? `${inWords(n.parts)} sit inside ${n.holder}. Select ${n.holder} to move them.` : `Click into ${n.holder} for what is inside it.`);
  if (around) {
    const others = around.kids.map((k) => k.label).filter((l) => l !== a.label);
    if (others.length) {
      const me = around.kids.find((k) => k.label === a.label);
      if (me) {
        const i = around.kids.indexOf(me);
        h += `<div class="de-arr-place"><span>Its place</span><button type="button" data-arr="place:-1" data-f="arr-earlier"${i === 0 ? " disabled" : ""}>↑ Earlier</button><button type="button" data-arr="place:1" data-f="arr-later"${i === around.kids.length - 1 ? " disabled" : ""}>↓ Later</button></div>`;
        notes.push(`It can change places with ${inWords(others)}. It cannot leave ${a.aroundLabel}: the block's code puts it there. Drag it, or use these.`);
      } else if (around.placed?.label === a.label) {
        notes.push(`It has its own column in ${a.aroundLabel}. Select ${a.aroundLabel} to change sides.`);
      }
    } else if (!inside.kids.length) {
      notes.push(noSwapWords(a.label, around, a.aroundLabel));
    }
  }
  if (!a.declaresParts) notes.push("This block lists no parts yet, so the things inside it cannot be moved one by one.");
  if (!h && !notes.length) return "";
  return `<div class="de-arrange" data-sync="arrange">${h}${notes.map((n) => `<p class="de-note">${n}</p>`).join("")}</div>`;
}
