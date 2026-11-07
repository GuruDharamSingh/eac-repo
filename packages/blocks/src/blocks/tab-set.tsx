import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";
import { TabSwitch } from "./tab-set.client";

// ============================================================================
// Tabs (2026-11-07): up to five tabs, each holding its own blocks.
//
// While a page is being edited every panel shows under its tab's name (`data-editing`).
//
// The block is server markup: a tab list and one panel per named tab. The only
// script is TabSwitch, a small island that hides the other panels and answers
// clicks and the arrow keys (WAI-ARIA tabs pattern). Without scripts every
// panel shows, one under the other, each under its tab's name, so nothing on
// the page is out of reach. A tab with no name is not drawn, so the author
// adds a tab by naming it.
//
// Five fixed slots rather than a list of tabs: Puck slots are declared props,
// and a list row cannot hold one. Renaming or reordering keeps the blocks with
// their slot (tab 2's blocks stay tab 2's).
// ============================================================================

const TAB_COUNT = 5;

const props = [
  { name: "label1", kind: "string", label: "Tab 1 name", default: "First" },
  { name: "panel1", kind: "slot", label: "Tab 1" },
  { name: "label2", kind: "string", label: "Tab 2 name", default: "Second" },
  { name: "panel2", kind: "slot", label: "Tab 2" },
  { name: "label3", kind: "string", label: "Tab 3 name", description: "Leave empty for no third tab.", default: "" },
  { name: "panel3", kind: "slot", label: "Tab 3" },
  { name: "label4", kind: "string", label: "Tab 4 name", default: "" },
  { name: "panel4", kind: "slot", label: "Tab 4" },
  { name: "label5", kind: "string", label: "Tab 5 name", default: "" },
  { name: "panel5", kind: "slot", label: "Tab 5" },
  {
    name: "look",
    kind: "select",
    label: "Look",
    default: "line",
    options: [
      { value: "line", label: "Line under the chosen tab" },
      { value: "pills", label: "Pills" },
      { value: "boxed", label: "Boxed, like folder tabs" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Tabs sit",
    default: "start",
    options: [
      { value: "start", label: "On the left" },
      { value: "center", label: "Centred" },
    ],
  },
] as const;

export type TabSetProps = PropsOf<typeof props> & { id?: string; puck?: { isEditing?: boolean; boxEditing?: boolean } };

/** A stable id for aria-controls: Puck gives every block an `id`; a hand-written page may not. */
const safeId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : "tabs");

export function TabSet(p: TabSetProps) {
  const base = `blk-tabs-${safeId(p.id)}`;
  const tabs = Array.from({ length: TAB_COUNT }, (_, i) => {
    const n = i + 1;
    const label = String((p as Record<string, unknown>)[`label${n}`] ?? "").trim();
    return { n, label, panel: (p as Record<string, unknown>)[`panel${n}`] as TabSetProps["panel1"] };
  }).filter((t) => t.label);
  if (tabs.length === 0) return null;
  // While the page is being edited (Puck, or the canvas's popup) every panel shows under its name: the editors take a
  // click on a tab to select the block, so a hidden panel could not be reached to drop a block into.
  const editing = Boolean(p.puck?.isEditing || p.puck?.boxEditing);
  return (
    <div className="blk blk-tabs" data-look={p.look ?? "line"} data-align={p.align ?? "start"} {...(editing ? { "data-editing": "" } : {})}>
      <div className="blk-tabs-list" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.n}
            type="button"
            role="tab"
            className="blk-tabs-tab"
            id={`${base}-t${t.n}`}
            aria-controls={`${base}-p${t.n}`}
            aria-selected={i === 0}
            tabIndex={i === 0 ? 0 : -1}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <section key={t.n} className="blk-tabs-panel" role="tabpanel" id={`${base}-p${t.n}`} aria-labelledby={`${base}-t${t.n}`} data-tab={t.n}>
          <h3 className="blk-tabs-heading">{t.label}</h3>
          <Region of={t.panel} className="blk-tabs-body" />
        </section>
      ))}
      <TabSwitch />
    </div>
  );
}

export const tabSet = defineBlock(
  {
    id: "tab-set",
    category: "layout",
    label: "Tabs",
    description: "Up to five tabs, each holding its own blocks. Name a tab to add it.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Tabs", sel: "> .blk-tabs" },
      list: { label: "Tab row", sel: "> .blk-tabs > .blk-tabs-list" },
      tab: { label: "Tab", sel: "> .blk-tabs > .blk-tabs-list > .blk-tabs-tab", repeat: true },
    },
  },
  TabSet,
  () => ({ label1: "First", label2: "Second", label3: "", label4: "", label5: "", look: "line" as const, align: "start" as const }),
);
