import type { ComponentType } from "react";
import { sanitizeRichText } from "@elkdonis/utils/sanitize";
import { defineBlock, type PropsOf } from "../registry";
import type { Block } from "../types";
import { sized, srcSet } from "../media";

// ============================================================================
// Record parts (2026-11-11): one record of any kind (a post, a gathering, a
// service, a tour), drawn in small pieces a page arranges itself.
//
//   record-header   title, the line above it, subtitle, date and author, cover
//   record-body     the record's own text
//   record-facts    its facts as the kind has them (when, where, format, price)
//   checkout        price and a pay button, for a record that is sold
//   rsvp            "Are you coming?", for a record that is scheduled
//
// Rules these blocks follow, so a site does not need its own copy of them:
//
//   - The one content setting is `record`: a reference the host reads
//     ("service:<slug>", "thread:<id>"), or empty for the record in the page's
//     address. Only the reference is stored; the host's resolver returns `rec`
//     per request, so the page follows the record.
//   - No organisation setting. The host resolves against the site it is
//     running on; a reference to another organisation's record resolves to
//     nothing.
//   - No framing copy. An eyebrow, a section heading or a back link is a
//     words box beside the block, not a setting inside it.
//   - Look through `--blk-*` tokens and parts.
//
// This package knows no database: `record` is declared `binds: "record"`, and
// a host that has records supplies the chooser and the resolver. None of the
// five is in SHARED_BLOCKS: a host adds them to its catalogue together with
// its resolver, so no site offers a block that can only draw nothing.
// `checkout` and `rsvp` act, so a host makes them with its own action
// (checkoutBlock, rsvpBlock).
// ============================================================================

/** What a host's resolver returns as `rec`. Structural; plain JSON; draw-only. */
export interface RecordView {
  /** "service", "post", "meeting"…: for the editor's note, never drawn to visitors. */
  kind?: string | null;
  title: string;
  /** The small line above the title, e.g. the feed's name or "A reading". */
  kicker?: string | null;
  subtitle?: string | null;
  /** Already formatted for the site's place and language, e.g. "7 November 2026". */
  dateLabel?: string | null;
  authorName?: string | null;
  /** A path on this site. */
  authorHref?: string | null;
  coverUrl?: string | null;
  /** Rich text. Sanitised again here at render, whatever the host did. */
  bodyHtml?: string | null;
  facts?: ReadonlyArray<{ label: string; value: string }> | null;
}

/** What a host's resolver returns as `pay` for `checkout`. */
export interface CheckoutView {
  /** The top (or only) price, in major units. Null: not for sale by card. */
  price: number | null;
  /** Set and below `price` when the buyer chooses an amount in a range. */
  priceMin?: number | null;
  currency: string;
  /** Under the amount field of a range, in the seller's words. */
  rangeNote?: string | null;
  /** Buying is open and the button may be drawn. */
  open: boolean;
  /** Why it cannot be bought now, as a sentence. Shown in place of the button. */
  unavailable?: string | null;
  /** A problem with the last attempt, as a sentence. */
  alert?: string | null;
  /** Under the button, in the host's words: what happens next ("You pay on …'s secure page"). Drawn only with the button. */
  note?: string | null;
  /** After payment: the confirmation, as a sentence. Replaces the form. */
  paidLine?: string | null;
  /** After payment: what the host's `After` needs (an order id, say). Plain strings; null draws no `After`. */
  after?: Readonly<Record<string, string>> | null;
}

/** What a host's resolver returns as `attendance` for `rsvp`. */
export interface RsvpView {
  open: boolean;
  /** This visitor's answer; null when none or signed out. */
  mine: "yes" | "no" | null;
  /** How many are coming; null when the host does not show it. */
  count?: number | null;
  /** Set for a signed-out visitor who must sign in to answer: a path on this site. */
  signInHref?: string | null;
  /** Why answers are closed, as a sentence. */
  closedLine?: string | null;
}

type Editing = { isEditing?: boolean; boxEditing?: boolean };
type Rec = { rec?: RecordView | null; puck?: Editing };

const RECORD_PROP = {
  name: "record",
  kind: "string",
  binds: "record",
  label: "Which record",
  description: "Empty: the one in the page's address (the usual case on a detail page).",
  default: "",
} as const;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const editingOf = (p: Editing | undefined) => !!(p?.isEditing || p?.boxEditing);
/** A path on this site; anything else is not a link. */
const sitePath = (u: string | null | undefined) => (u && /^\/(?!\/)[^\s"]*$/.test(u) ? u : null);
/** https or a path on this site. */
const safePicture = (u: string | null | undefined) => (u && (/^https:\/\//i.test(u) || /^\/(?!\/)/.test(u)) ? u : null);

/** What an editor sees where visitors see nothing. */
function Empty({ what }: { what: string }) {
  return (
    <div className="blk blk-rcd blk-rcd--empty">
      <p className="blk-rcd-note">{what}</p>
    </div>
  );
}

// ── header ──────────────────────────────────────────────────────────────────

const headerProps = [
  RECORD_PROP,
  { name: "showKicker", kind: "boolean", label: "Small line above the title", default: true },
  { name: "showSubtitle", kind: "boolean", label: "Subtitle", default: true },
  { name: "showMeta", kind: "boolean", label: "Date and author", default: true },
  { name: "showCover", kind: "boolean", label: "Cover picture", default: true },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
] as const;

export type RecordHeaderProps = PropsOf<typeof headerProps> & Rec;

export function RecordHeader({ showKicker = true, showSubtitle = true, showMeta = true, showCover = true, align = "start", rec, puck }: RecordHeaderProps) {
  if (!rec || !text(rec.title)) return editingOf(puck) ? <Empty what="Record header: no record to show here yet." /> : null;
  const cover = showCover ? safePicture(rec.coverUrl) : null;
  const author = text(rec.authorName);
  const authorHref = sitePath(rec.authorHref);
  const date = text(rec.dateLabel);
  return (
    <header className="blk blk-rcd blk-rcd-head" data-align={align}>
      {showKicker && text(rec.kicker) ? <p className="blk-rcd-kicker">{rec.kicker}</p> : null}
      <h1 className="blk-rcd-title">{rec.title}</h1>
      {showSubtitle && text(rec.subtitle) ? <p className="blk-rcd-sub">{rec.subtitle}</p> : null}
      {showMeta && (date || author) ? (
        <p className="blk-rcd-meta">
          {date ? <span>{date}</span> : null}
          {date && author ? <span aria-hidden="true"> · </span> : null}
          {author ? authorHref && !editingOf(puck) ? <a href={authorHref}>{author}</a> : <span>{author}</span> : null}
        </p>
      ) : null}
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="blk-rcd-cover" src={sized(cover, 1600)} srcSet={srcSet(cover)} sizes="(max-width: 800px) 100vw, 800px" alt="" />
      ) : null}
    </header>
  );
}

const SAMPLE: RecordView = {
  kind: "service",
  kicker: "A reading",
  title: "An hour with the figure",
  subtitle: "One conversation, at your pace.",
  dateLabel: null,
  authorName: null,
  coverUrl: null,
  bodyHtml: "<p>We begin where you are. Bring one question; leave with a way to keep looking at it.</p>",
  facts: [
    { label: "Kind", value: "One-on-one" },
    { label: "Format", value: "Online" },
    { label: "Length", value: "1 h" },
  ],
};

export const recordHeader = defineBlock(
  {
    id: "record-header",
    label: "Record: header",
    category: "headers",
    description: "The title of a post, gathering or service, with its small line, subtitle, date, author and cover. Its words come from the record.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props: headerProps,
    parts: {
      root: { label: "Header", sel: "> .blk-rcd-head" },
      kicker: { label: "Small line", sel: ".blk-rcd-kicker" },
      title: { label: "Title", sel: ".blk-rcd-title" },
      subtitle: { label: "Subtitle", sel: ".blk-rcd-sub" },
      meta: { label: "Date and author", sel: ".blk-rcd-meta" },
      cover: { label: "Cover", sel: ".blk-rcd-cover" },
    },
  },
  RecordHeader,
  (): RecordHeaderProps => ({ record: "", showKicker: true, showSubtitle: true, showMeta: true, showCover: true, align: "start", rec: SAMPLE })
);

// ── body ────────────────────────────────────────────────────────────────────

const bodyProps = [
  RECORD_PROP,
  {
    name: "width",
    kind: "select",
    label: "Width",
    default: "reading",
    options: [
      { value: "reading", label: "Reading column" },
      { value: "full", label: "Full" },
    ],
  },
] as const;

export type RecordBodyProps = PropsOf<typeof bodyProps> & Rec;

export function RecordBody({ width = "reading", rec, puck }: RecordBodyProps) {
  // Sanitised here as well as by the host: this is the one place the markup is
  // set as HTML, and a host that forgot must not turn a page into script.
  const html = rec?.bodyHtml ? sanitizeRichText(rec.bodyHtml) : "";
  if (!html.trim()) return editingOf(puck) ? <Empty what="Record text: this record has no text yet." /> : null;
  return <div className="blk blk-rcd blk-rcd-body" data-width={width} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const recordBody = defineBlock(
  {
    id: "record-body",
    label: "Record: text",
    category: "content",
    description: "The record's own text, as its author wrote it.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props: bodyProps,
    parts: { root: { label: "Text", sel: "> .blk-rcd-body" } },
  },
  RecordBody,
  (): RecordBodyProps => ({ record: "", width: "reading", rec: SAMPLE })
);

// ── facts ───────────────────────────────────────────────────────────────────

const factsProps = [
  RECORD_PROP,
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "row",
    options: [
      { value: "row", label: "In a row" },
      { value: "list", label: "As a list" },
    ],
  },
] as const;

export type RecordFactsProps = PropsOf<typeof factsProps> & Rec;

export function RecordFacts({ layout = "row", rec, puck }: RecordFactsProps) {
  const facts = (rec?.facts ?? []).filter((f) => text(f?.label) && text(f?.value));
  if (!facts.length) return editingOf(puck) ? <Empty what="Record facts: nothing to list for this record." /> : null;
  return (
    <dl className="blk blk-rcd blk-rcd-facts" data-layout={layout}>
      {facts.map((f) => (
        <div key={f.label} className="blk-rcd-fact">
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const recordFacts = defineBlock(
  {
    id: "record-facts",
    label: "Record: facts",
    category: "content",
    description: "When, where, format, length: the facts the record's kind has. Hidden when there are none.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props: factsProps,
    parts: {
      root: { label: "Facts", sel: "> .blk-rcd-facts" },
      fact: { label: "One fact", sel: ".blk-rcd-fact" },
    },
  },
  RecordFacts,
  (): RecordFactsProps => ({ record: "", layout: "row", rec: SAMPLE })
);

// ── checkout ────────────────────────────────────────────────────────────────

const checkoutProps = [
  RECORD_PROP,
  { name: "buttonLabel", kind: "string", label: "Button", default: "Book and pay", inlineEditable: true },
] as const;

export type CheckoutProps = PropsOf<typeof checkoutProps> & Rec & { pay?: CheckoutView | null; recordRef?: string | null };

/** What a host gives `checkoutBlock`. */
export interface CheckoutHost {
  /**
   * The host's own server action: start a payment for the record `ref` names
   * (the reference the resolver returned as `recordRef`). It reads `amount`
   * from the form when the price is a range, checks everything again on the
   * server, and redirects. The block never trusts what it drew.
   */
  action: (ref: string, formData: FormData) => Promise<void>;
  /** Drawn after payment, under the confirmation: e.g. a form asking for times. Server-rendered. */
  After?: ComponentType<{ recordRef: string; after: Readonly<Record<string, string>> }>;
  /** Class names for the amount field and the button, so they take the site's control styles. */
  inputClass?: string;
  buttonClass?: string;
}

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
};

/** The `checkout` block for one host. Same id on every site, so pages move between them. */
export function checkoutBlock(host: CheckoutHost): Block<CheckoutProps> {
  function Checkout({ buttonLabel, rec, pay, recordRef, puck }: CheckoutProps) {
    const editing = editingOf(puck);
    const ref = text(recordRef);
    if (!rec || !pay || !ref) return editing ? <Empty what="Checkout: no record for sale here yet." /> : null;
    const ranged = pay.price != null && pay.priceMin != null && pay.priceMin < pay.price;
    const After = host.After;
    const inner = text(pay.paidLine) ? (
      <>
        <p role="status" className="blk-pay-paid">
          {pay.paidLine}
        </p>
        {After && pay.after ? <After recordRef={ref} after={pay.after} /> : null}
      </>
    ) : pay.open && pay.price != null ? (
      <form action={host.action.bind(null, ref)} className="blk-pay-form">
        <p className="blk-pay-price">{ranged ? `${money(pay.priceMin!, pay.currency)} – ${money(pay.price, pay.currency)}` : money(pay.price, pay.currency)}</p>
        {ranged ? (
          <label className="blk-pay-amount">
            <span>Amount ({pay.currency})</span>
            <input type="number" name="amount" className={host.inputClass} min={pay.priceMin!} max={pay.price} step="1" defaultValue={pay.price} required />
            {text(pay.rangeNote) ? <span className="blk-pay-note">{pay.rangeNote}</span> : null}
          </label>
        ) : null}
        {text(pay.alert) ? (
          <p role="alert" className="blk-pay-alert">
            {pay.alert}
          </p>
        ) : null}
        {text(pay.unavailable) ? (
          <p className="blk-pay-note">{pay.unavailable}</p>
        ) : (
          <button type="submit" className={`blk-pay-button${host.buttonClass ? ` ${host.buttonClass}` : ""}`} data-book-and-pay="">
            {buttonLabel || "Book and pay"}
          </button>
        )}
        {!text(pay.unavailable) && text(pay.note) ? <p className="blk-pay-small">{pay.note}</p> : null}
      </form>
    ) : (
      <p className="blk-pay-note">{text(pay.unavailable) || "Not open for booking at the moment."}</p>
    );
    return (
      <section className="blk blk-rcd blk-pay" aria-label="Booking">
        {/* In an editor nothing here acts: a click selects the block. */}
        {editing ? <div inert>{inner}</div> : inner}
      </section>
    );
  }
  return defineBlock(
    {
      id: "checkout",
      label: "Checkout",
      category: "actions",
      description: "The price of a service, workshop or tour and a button that takes the buyer to the card page. Sold by this site only.",
      memberSafe: true,
      dataDriven: true,
      styling: "tokens",
      props: checkoutProps,
      parts: {
        root: { label: "Booking box", sel: "> .blk-pay" },
        price: { label: "Price", sel: ".blk-pay-price" },
        button: { label: "Button", sel: ".blk-pay-button", prop: "buttonLabel" },
      },
    },
    Checkout,
    (): CheckoutProps => ({ record: "", buttonLabel: "Book and pay", rec: SAMPLE, recordRef: "sample", pay: { price: 120, priceMin: 80, currency: "CAD", open: true } })
  );
}

// ── rsvp ────────────────────────────────────────────────────────────────────

const rsvpProps = [
  RECORD_PROP,
  { name: "yesLabel", kind: "string", label: "Yes button", default: "I’m coming", inlineEditable: true },
  { name: "showCount", kind: "boolean", label: "Show how many are coming", default: true },
] as const;

export type RsvpProps = PropsOf<typeof rsvpProps> & Rec & { attendance?: RsvpView | null; recordRef?: string | null };

/** What a host gives `rsvpBlock`. */
export interface RsvpHost {
  /** The host's own server action: record `answer` ("yes" | "no", read from the form) for the signed-in person. */
  action: (ref: string, formData: FormData) => Promise<void>;
  buttonClass?: string;
}

/** The `rsvp` block for one host. */
export function rsvpBlock(host: RsvpHost): Block<RsvpProps> {
  function Rsvp({ yesLabel, showCount = true, rec, attendance, recordRef, puck }: RsvpProps) {
    const editing = editingOf(puck);
    const ref = text(recordRef);
    const a = attendance ?? null;
    if (!rec || !a || !ref) return editing ? <Empty what="RSVP: no gathering to answer for here yet." /> : null;
    const cls = `blk-rsvp-button${host.buttonClass ? ` ${host.buttonClass}` : ""}`;
    const signIn = sitePath(a.signInHref);
    const count = showCount && typeof a.count === "number" && a.count > 0 ? <p className="blk-rsvp-count">{a.count} coming</p> : null;
    const inner = !a.open ? (
      <p className="blk-rsvp-note">{text(a.closedLine) || "Answers are closed."}</p>
    ) : signIn ? (
      <a className={cls} href={signIn}>
        Sign in to answer
      </a>
    ) : (
      <form action={host.action.bind(null, ref)} className="blk-rsvp-form">
        {a.mine === "yes" ? <p role="status" className="blk-rsvp-mine">You are coming.</p> : null}
        <button type="submit" name="answer" value={a.mine === "yes" ? "no" : "yes"} className={cls} data-current={a.mine ?? ""}>
          {a.mine === "yes" ? "I can’t come after all" : yesLabel || "I’m coming"}
        </button>
      </form>
    );
    return (
      <section className="blk blk-rcd blk-rsvp" aria-label="Are you coming?">
        {editing ? <div inert>{inner}</div> : inner}
        {count}
      </section>
    );
  }
  return defineBlock(
    {
      id: "rsvp",
      label: "RSVP",
      category: "actions",
      description: "“I’m coming” for a gathering on this site, with the count.",
      memberSafe: true,
      dataDriven: true,
      styling: "tokens",
      props: rsvpProps,
      parts: {
        root: { label: "RSVP", sel: "> .blk-rsvp" },
        button: { label: "Button", sel: ".blk-rsvp-button", prop: "yesLabel" },
        count: { label: "Count", sel: ".blk-rsvp-count" },
      },
    },
    Rsvp,
    (): RsvpProps => ({ record: "", yesLabel: "I’m coming", showCount: true, rec: SAMPLE, recordRef: "sample", attendance: { open: true, mine: null, count: 7 } })
  );
}

/** The keys these blocks' resolvers fill, for a host's save-time strip (`stripResolvedKeys`). Route keys included. */
export const RECORD_RESOLVED_KEYS: Record<string, readonly string[]> = {
  "record-header": ["rec", "routeRecord"],
  "record-body": ["rec", "routeRecord"],
  "record-facts": ["rec", "routeRecord"],
  checkout: ["rec", "pay", "recordRef", "routeRecord", "routeQuery"],
  rsvp: ["rec", "attendance", "recordRef", "routeRecord"],
};

/** The ids, for a route that hands the address to every record block on a page. */
export const RECORD_BLOCK_IDS: readonly string[] = Object.keys(RECORD_RESOLVED_KEYS);
