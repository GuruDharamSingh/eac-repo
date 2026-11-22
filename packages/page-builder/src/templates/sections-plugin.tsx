"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Render, useGetPuck, type Data, type Plugin } from "@puckeditor/core";
import type { Section } from "@elkdonis/blocks/sections";
import { instantiate } from "./instantiate";
import { placeSection, type WrapIn } from "./insert";

// ============================================================================
// A "Sections" tab for the editor's left rail: add a section to the page,
// beside the Templates tab, which replaces the whole page.
//
// Sections are grouped by purpose. Each card shows a small live picture drawn
// from the section's real blocks (only once it scrolls into view), a line about
// it, and "Add to page". Adding goes after the selected block, or at the end of
// the page; it is one undo step and selects the first new block. See insert.ts.
// ============================================================================

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const PREVIEW_WIDTH = 880;
const PREVIEW_HEIGHT = 150;

/** The section drawn by the real blocks, scaled down, drawn only once visible. Never takes a click. */
function Thumbnail({ section }: { section: Section }) {
  const box = useRef<HTMLDivElement>(null);
  const getPuck = useGetPuck();
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.1, el.clientWidth / PREVIEW_WIDTH));
    measure();
    const size = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    size?.observe(el);
    let seen: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") setVisible(true);
    else {
      seen = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          seen?.disconnect();
        }
      });
      seen.observe(el);
    }
    return () => {
      size?.disconnect();
      seen?.disconnect();
    };
  }, []);

  // Own ids, so a preview never shares an id with the page.
  const data = useMemo<Data>(() => ({ root: { props: {} }, content: instantiate(section.blocks, []) }) as Data, [section]);

  return (
    <div
      ref={box}
      aria-hidden="true"
      style={{
        height: PREVIEW_HEIGHT * scale + 8,
        overflow: "hidden",
        position: "relative",
        borderRadius: 6,
        background: "#f4f1ea",
        border: "1px solid var(--puck-color-grey-09, #dcdcdc)",
        pointerEvents: "none",
      }}
    >
      {visible ? (
        <Boundary fallback={<span style={{ fontSize: 12, padding: 8, display: "block" }}>{section.label}</span>}>
          <div style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left", padding: 16, boxSizing: "border-box" }}>
            <Render config={getPuck().config} data={data} />
          </div>
        </Boundary>
      ) : null}
    </div>
  );
}

function SectionsPanel({ sections, wrapIn }: { sections: Section[]; wrapIn?: WrapIn }) {
  const getPuck = useGetPuck();
  const [added, setAdded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const out = new Map<string, Section[]>();
    for (const s of sections) out.set(s.group, [...(out.get(s.group) ?? []), s]);
    return [...out.entries()];
  }, [sections]);

  const add = (section: Section) => {
    const puck = getPuck();
    const placed = placeSection(puck.appState.data, section, puck.appState.ui.itemSelector, wrapIn);
    // One document in, one undo step.
    puck.dispatch({ type: "setData", data: placed.data, recordHistory: true });
    // Once the nodes are in the store: ask data blocks to fetch, and select the first new block.
    window.setTimeout(() => {
      const now = getPuck();
      for (const id of placed.ids) now.resolveDataById(id, "force");
      const selector = placed.firstId ? now.getSelectorForId(placed.firstId) : undefined;
      if (selector) now.dispatch({ type: "setUi", recordHistory: false, ui: { itemSelector: selector } });
    }, 0);
    setAdded(section.id);
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, fontFamily: "var(--puck-font-family, system-ui)" }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--puck-color-text-secondary, #404040)" }}>
        Add a ready-made section to the page. It goes after the block you have selected, or at the end. Afterwards
        it is ordinary blocks: change, move or delete any of it.
      </p>
      {groups.map(([group, list]) => (
        <section key={group} style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5a5a5a" }}>
            {group}
          </h3>
          {list.map((s) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gap: 6,
                padding: 10,
                border: `1px solid ${added === s.id ? "var(--puck-color-azure-04, #0158ad)" : "var(--puck-color-grey-09, #dcdcdc)"}`,
                borderRadius: 8,
                background: "var(--puck-color-white, #fff)",
                color: "var(--puck-color-black, #000)",
              }}
            >
              <Thumbnail section={s} />
              <strong style={{ fontSize: 14 }}>{s.label}</strong>
              <span style={{ fontSize: 12, lineHeight: 1.4, color: "#404040" }}>{s.description}</span>
              <button
                type="button"
                onClick={() => add(s)}
                style={{
                  justifySelf: "start",
                  padding: "6px 12px",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--puck-color-azure-04, #0158ad)",
                  borderRadius: 6,
                  background: "var(--puck-color-azure-04, #0158ad)",
                  color: "#fff",
                }}
              >
                Add to page
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="6" rx="1" />
    <rect x="3" y="11" width="18" height="4" rx="1" />
    <path d="M12 18v4M10 20h4" />
  </svg>
);

/** The Sections tab, for `PuckEditor`'s `plugins`. Made once (module scope): Puck rebuilds its UI when a plugin changes identity. */
export function sectionsPlugin(
  sections: Section[],
  { label = "Sections", wrapIn }: { label?: string; wrapIn?: WrapIn } = {},
): Plugin {
  return {
    name: "eac-sections",
    label,
    icon: ICON,
    render: () => <SectionsPanel sections={sections} wrapIn={wrapIn} />,
  };
}
