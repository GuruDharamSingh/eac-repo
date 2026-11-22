import Link from "next/link";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { ArchFrame, CatalogueRow } from "@/components/mobile";
import { WHO_OPTIONS } from "@/lib/puck/viewer-rank";
import { buttonsFor, type ShownButton } from "./page-buttons-logic";

// ============================================================================
// m-page-buttons (2026-11-21): the group of buttons at the foot of the phone landing, as one block with a list. Today
// they are the places catalogue, the forum, and a button that is "Log in" for a visitor, the person's name when signed
// in, and "The Office" for a guide or owner. Before this block that was the second half of m-link-rows, drawn by code.
//
// WHO SEES WHAT is decided on the server. The resolver (lib/puck/mobile-buttons.ts) reads the session, keeps only the
// buttons this person may see, picks the form that applies to them, and returns `shown`. This component draws `shown`
// and never the stored `buttons`, so a visitor's HTML holds no label or link they may not see. The editor's copy of the
// resolver gives an editor every button, each tagged with who it is for (`note`).
// ============================================================================

const WHO = WHO_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const SWAP_WHO = [{ value: "none", label: "No second form" }, ...WHO.filter((o) => ["signed-in", "member", "guide", "owner"].includes(o.value))];

const props = [
  {
    name: "buttons",
    kind: "rows",
    label: "Buttons",
    addLabel: "Add a button",
    summary: ["label", "who"],
    description: "Empty: the standard three (places catalogue, forum, log in / account / the office).",
    fields: [
      { name: "label", kind: "string", label: "Words on the button", default: "" },
      { name: "to", kind: "string", label: "Where it goes", description: "A page of this site (/places) or an https address.", default: "" },
      { name: "who", kind: "select", label: "Who sees it", default: "everyone", options: WHO },
      { name: "look", kind: "select", label: "Look", default: "row", options: [{ value: "row", label: "Row with a dot" }, { value: "pill", label: "Small pill" }, { value: "catalogue", label: "Catalogue card (picture, kicker, line)" }] },
      { name: "width", kind: "select", label: "Width", default: "full", options: [{ value: "full", label: "Full width" }, { value: "half", label: "Half: sits beside the next half" }] },
      { name: "kicker", kind: "string", label: "Catalogue card: small line above", default: "" },
      { name: "meta", kind: "string", label: "Catalogue card: line below", description: "{count} is the number of public places.", default: "" },
      { name: "swapWho", kind: "select", label: "Second form for", description: "People of this role and above see the next two fields instead.", default: "none", options: SWAP_WHO },
      { name: "swapLabel", kind: "string", label: "Second form: words", description: "{name} is the person's first name.", default: "" },
      { name: "swapTo", kind: "string", label: "Second form: where it goes", default: "" },
      { name: "swap2Who", kind: "select", label: "Third form for", description: "A higher role, if you want a third form (the Office for guides).", default: "none", options: SWAP_WHO },
      { name: "swap2Label", kind: "string", label: "Third form: words", default: "" },
      { name: "swap2To", kind: "string", label: "Third form: where it goes", default: "" },
    ],
  },
  { name: "accountLabel", kind: "string", label: "Words when a signed-in person has no name", description: "Used where {name} is.", default: "Account", inlineEditable: true },
] as const;

export type MPageButtonsProps = PropsOf<typeof props> & { shown?: ShownButton[] | null; /** The Feed row sits right above this block (it keeps the 16 px gap the rows always had). */ afterFeed?: boolean };

function Button({ b }: { b: ShownButton }) {
  const note = b.note ? <span className="blk-mpb-note">{b.note}</span> : null;
  if (b.look === "catalogue") {
    return (
      <div className="blk-mlr-places">
        <CatalogueRow href={b.to} thumb={<ArchFrame w={44} h={52} bottom={7} brass />} kicker={b.kicker} title={b.label} meta={b.meta} />
        {note}
      </div>
    );
  }
  if (b.look === "pill") {
    return (
      <Link href={b.to} className={"m-row blk-mlr-login blk-mpb-pill" + (b.width === "full" ? " blk-mpb-pill--full" : "")}>
        <span className="blk-mlr-login-text">{b.label}</span>
        {note}
      </Link>
    );
  }
  return (
    <Link href={b.to} className="m-row blk-mlr-forum">
      <span className="blk-mmast-dot blk-mlr-forum-dot" />
      <span className="m-row-text blk-mlr-forum-title">{b.label}</span>
      <span className="m-row-chev">›</span>
      {note}
    </Link>
  );
}

/** Consecutive half-width buttons share one line; a full-width catalogue card stands alone. */
function group(list: ShownButton[]): ShownButton[][] {
  const out: ShownButton[][] = [];
  for (const b of list) {
    const last = out[out.length - 1];
    if (b.width === "half" && last && last[0]!.width === "half") last.push(b);
    else out.push([b]);
  }
  return out;
}

export const mPageButtons = defineBlock(
  {
    id: "m-page-buttons",
    category: "content",
    label: "Phone page buttons",
    description: "A group of buttons: each has its words, where it goes and who sees it (everyone, signed-in people, or a role and above). A button can change for a role (the Office for guides).",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    reads: [
      { from: "viewer", what: "signed-in" },
      { from: "viewer", what: "role" },
      { from: "site", what: "org" },
    ],
    parts: {
      root: { label: "Page buttons", sel: "> .blk-mpb" },
      button: { label: "A button", sel: ".m-row" },
    },
  },
  ({ shown, afterFeed }: MPageButtonsProps) =>
    shown && shown.length > 0 ? (
      <div className={"blk blk-mlr blk-mpb" + (afterFeed ? " blk-mpb--after-feed" : "")}>
        {group(shown).map((g, i) =>
          g[0]!.look === "catalogue" && g.length === 1 ? (
            <Button key={i} b={g[0]!} />
          ) : (
            <div key={i} className="blk-mlr-pair">
              {g.map((b, j) => <Button key={j} b={b} />)}
            </div>
          )
        )}
      </div>
    ) : null,
  () => ({ accountLabel: "Account", shown: buttonsFor(undefined, { viewer: null, count: 75, accountLabel: "Account" }) })
);
